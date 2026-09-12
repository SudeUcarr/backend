import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildFeatures, featureNames, predict, predictFuture} from '../src/modules/occupancy/model.ts'
import {getOccupancyDemo, predictOccupancy} from '../src/modules/occupancy/service.ts'
import {handleRequest} from '../src/app.ts'

const asset = name => JSON.parse(readFileSync(new URL('../src/modules/occupancy/assets/' + name, import.meta.url), 'utf8'))
const demo = asset('demo.json'), forecast = asset('forecast.json')
const forest = asset('forest.json'), futureForest = asset('forecast-forest.json')
const close = (actual, expected, tolerance = .00001) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`)

test('entry windows exclude future events and prior days and preserve same-second arrivals', () => {
  assert.deepEqual(buildFeatures([
    {time:'2016-04-08T11:45:00',count:2}, {time:'2016-04-08T11:45:01',count:3},
    {time:'2016-04-08T12:00:00',count:1}, {time:'2016-04-08T12:00:01',count:100},
    {time:'2016-04-07T23:59:59',count:100}
  ],'2016-04-08T12:00:00'), [12,4,4,6,6,6,6,6])
  assert.equal(buildFeatures([{time:'2016-04-08T12:00:00',count:1},{time:'2016-04-08T12:00:00',count:2}], '2016-04-08T12:00:00')[2],3)
  for (const stamp of ['broken','2016-02-30T12:00:00','2016-04-08T12:00:00+03:00']) assert.throws(() => buildFeatures([],stamp))
  for (const count of [-1,1.5,NaN]) assert.throws(() => buildFeatures([{time:'2016-04-08T12:00:00',count}], '2016-04-08T12:00:00'))
})

test('server reconstructs all 2,103 held-out feature vectors and Python current predictions', () => {
  assert.equal(demo.rows.length,2103)
  assert.ok(demo.report.split.train.to < demo.report.split.validation.from)
  assert.ok(demo.report.split.validation.to < demo.report.split.test.from)
  for (const row of demo.rows) {
    const result = predictOccupancy(row.timestamp)
    result.features.forEach((value,index) => close(value,row[featureNames[index]],.000001))
    close(result.nowEstimate,row.prediction)
  }
})

test('all 1,955 future predictions match Python and use only origin-time events', () => {
  assert.equal(forecast.rows.length,1955)
  assert.equal(forecast.report.sourceSha256,demo.report.audit.sha256)
  assert.ok(forecast.report.split.train.lastTargetTime < forecast.report.split.validation.from)
  assert.ok(forecast.report.split.validation.lastTargetTime < forecast.report.split.test.from)
  const targets = new Map(demo.rows.map(row => [row.timestamp,row.target]))
  let error = 0
  for (const row of forecast.rows) {
    const entries = demo.entryDays[row.timestamp.slice(0,10)]
    const features = buildFeatures(entries,row.timestamp)
    const result = predictOccupancy(row.timestamp)
    close(result.futureEstimate,row.forecastPrediction)
    assert.equal(result.forecastTime,row.forecastTime)
    assert.equal(Date.parse(row.forecastTime+'Z') - Date.parse(row.timestamp+'Z'),3600000)
    assert.equal(row.futureTarget,targets.get(row.forecastTime))
    assert.deepEqual(buildFeatures(entries.map(entry => entry.time > row.timestamp ? {...entry,count:999} : entry),row.timestamp),features)
    error += Math.abs(result.futureEstimate-row.futureTarget)
  }
  close(error/forecast.rows.length,forecast.report.test.mae,.0001)
  assert.throws(() => predictFuture(forest,[12,4,1,2,3,4,5,6]),/60 dakika/)
})

test('coverage gaps remain null and simulated entrances recalculate both forests', () => {
  const futureTimes = new Set(forecast.rows.map(row => row.timestamp))
  let uncovered = 0
  for (const row of demo.rows.filter(row => !futureTimes.has(row.timestamp))) {
    const result = predictOccupancy(row.timestamp,1)
    assert.equal(result.futureEstimate,null)
    assert.equal(result.forecastTime,null)
    uncovered++
  }
  assert.equal(uncovered,148)
  const time = forecast.rows[12].timestamp
  const original = predictOccupancy(time), modified = predictOccupancy(time,3)
  assert.deepEqual(modified.features,original.features.map((value,index) => index >= 2 ? value+3 : value))
  close(modified.nowEstimate,predict(forest,modified.features))
  close(modified.futureEstimate,predictFuture(futureForest,modified.features))
})

const env = {APP_ORIGIN:'http://127.0.0.1:5173'}
const req = (path, body) => new Request('http://127.0.0.1:3001/api/occupancy/'+path, body === undefined ? {} :
  {method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify(body)})

test('public occupancy endpoints work without Supabase and never expose forests or raw entry histories', async t => {
  t.mock.method(globalThis,'fetch',() => {throw new Error('ML must not contact an upstream service')})
  const response = await handleRequest(req('demo'),env)
  assert.equal(response.status,200)
  assert.equal(response.headers.get('cache-control'),'no-store')
  const data = await response.json()
  assert.deepEqual(data,getOccupancyDemo())
  assert.equal(data.demo.entryDays,undefined)
  assert.deepEqual(Object.keys(data.demo.rows[0]).sort(),['day','entries15','prediction','target','timestamp'])
  assert.equal(/"trees"\s*:\s*\[|"threshold"|"entryDays"/.test(JSON.stringify(data)),false)
  assert.equal(data.venues.length,6)
  const timestamp = forecast.rows[0].timestamp
  const prediction = await handleRequest(req('predict',{timestamp,extraEntries:2}),env)
  assert.equal(prediction.status,200)
  assert.deepEqual(await prediction.json(),predictOccupancy(timestamp,2))
})

test('prediction API rejects arbitrary data, invalid counts, oversized bodies and foreign origins', async () => {
  const timestamp = demo.rows[0].timestamp
  for (const body of [null,[],{}, {timestamp:'2026-09-12T12:00:00'}, {timestamp,entries:[]},
    ...[-1,1.5,10001,'1',null].map(extraEntries => ({timestamp,extraEntries}))]) {
    const result = await handleRequest(req('predict',body),env)
    assert.equal(result.status,400,JSON.stringify(body))
  }
  assert.equal((await handleRequest(req('predict',{timestamp,extraEntries:10000}),env)).status,200)
  assert.equal((await handleRequest(req('predict',{timestamp,extraEntries:0,padding:'x'.repeat(65536)}),env)).status,413)
  const foreign = req('predict',{timestamp}); foreign.headers.set('Origin','https://evil.invalid')
  assert.equal((await handleRequest(foreign,env)).status,403)
  const noOrigin = req('predict',{timestamp}); noOrigin.headers.delete('Origin')
  assert.equal((await handleRequest(noOrigin,env)).status,403)
})
