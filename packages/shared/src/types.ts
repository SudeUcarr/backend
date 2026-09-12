export interface University {id:string;name:string;short_name:string;city:string}
export interface Campus {id:string;university_id:string;name:string;latitude?:number|null;longitude?:number|null;address?:string|null;source_url?:string|null}
export interface Course {id:string;university_id:string;name:string;code:string}
export interface Profile {id:string;display_name:string;university_id:string;department:string}
export interface Member {id:string;display_name:string}
interface Owned {id:string;user_id:string;created_at:string}
interface Example {is_example:boolean}
export interface Internship extends Example {id:string;university_id:string|null;title:string;company:string;field:string;location:string;work_mode:string;description:string;source_url:string|null;deadline:string|null;user_id?:string|null;created_at?:string;source_kind?:'student'|'import'|'example';source_provider?:string|null;source_name?:string;fetched_at?:string|null;status?:'active'|'closed'}
export interface Post extends Owned,Example {university_id:string;course_id:string;kind:'note'|'question';title:string;body:string;link_url:string|null;attachment_path:string|null;published:boolean}
export interface Reply extends Owned {post_id:string;body:string}
export type ListingKind='market'|'housing'|'roommate'
export interface Listing extends Owned,Example {university_id:string;kind:ListingKind;title:string;description:string;category:string;price_kurus:number;deposit_kurus:number;district:string;available_from:string|null;lifestyle:string;contact:string;image_path:string|null;status:'active'|'closed'}
export interface BudgetEntry extends Owned {type:'income'|'expense';amount_kurus:number;category:string;note:string;occurred_on:string}
export interface Place extends Example {id:string;university_id:string;name:string;category:string;price_level:number;district:string;description:string;symbol:string;user_id?:string|null;created_at?:string;campus_id?:string|null;address?:string;maps_url?:string|null;latitude?:number|null;longitude?:number|null;meal_price_kurus?:number|null;price_observed_on?:string|null}
export interface Review extends Owned {place_id:string;rating:number;body:string}
export interface Club extends Example {id:string;university_id:string;name:string;category:string;description:string;initials:string;color:string}
export interface ClubEvent extends Example {id:string;club_id:string;title:string;starts_at:string;location:string;description:string}
export interface CalendarItem extends Owned {title:string;kind:'exam'|'deadline'|'event';due_at:string;reminder_minutes:number;email_enabled:boolean;completed:boolean;club_event_id:string|null;revision:number}
export interface CrowdLocation {id:string;university_id:string;campus_id:string;name:string;kind:'library'|'dining'}
export interface CrowdReport extends Owned,Example {location_id:string;level:1|2|3}
export interface Follow {id:string;user_id:string;club_id:string}
export interface Saved {id:string;user_id:string;internship_id:string}
export interface Notification extends Owned {calendar_id:string|null;title:string;body:string;read_at:string|null}
export interface ReminderJob {id:string;calendar_id:string|null;user_id:string;state:string;last_error:string|null}
export interface TableRows {universities:University;campuses:Campus;courses:Course;members:Member;internships:Internship;posts:Post;replies:Reply;listings:Listing;budget_entries:BudgetEntry;places:Place;reviews:Review;clubs:Club;club_events:ClubEvent;calendar_items:CalendarItem;crowd_locations:CrowdLocation;crowd_reports:CrowdReport;club_follows:Follow;saved_internships:Saved;notifications:Notification;reminder_jobs:ReminderJob}
export type TableName=keyof TableRows
export type DatabaseState={[K in TableName]:TableRows[K][]}
export const tableNames:TableName[]=['universities','campuses','courses','members','internships','posts','replies','listings','budget_entries','places','reviews','clubs','club_events','calendar_items','crowd_locations','crowd_reports','club_follows','saved_internships','notifications','reminder_jobs']
export const emptyData=()=>Object.fromEntries(tableNames.map(t=>[t,[]])) as unknown as DatabaseState
