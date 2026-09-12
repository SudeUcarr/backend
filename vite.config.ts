import {defineConfig} from 'vite'
export default defineConfig({
  ssr: {target: 'webworker', noExternal: true},
  build: {
    ssr: 'src/worker.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2023',
    rolldownOptions: {output: {entryFileNames: 'index.js'}}
  }
})
