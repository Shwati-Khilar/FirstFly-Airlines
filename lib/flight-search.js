import { HttpError, positiveId } from './http.js'
import { validTravelDate } from './flight-card-schedule.js'
export const flightColumns = 'flight_code,flight_name,current_location,desired_location,departure_time,arrival_time,price,status,EXISTS (SELECT 1 FROM demo_flights d WHERE d.flight_code=flights.flight_code) AS is_demo'
export function flightSearch(input = {}) {
  const page = input.page === undefined ? 1 : positiveId(input.page, 'page')
  if (page > 100000) throw new HttpError(400, 'Page is too large')
  const values = [], predicates = []
  for (const [key, column] of [['from','current_location'],['to','desired_location']]) {
    const value = input[key] ?? ''
    if (typeof value !== 'string' || value.length > 50) throw new HttpError(400, 'Invalid city')
    if (value.trim()) { predicates.push(`${column}=?`); values.push(value.trim()) }
  }
  if (input.date !== undefined) {
    if (!validTravelDate(input.date)) throw new HttpError(400, 'Select a valid travel date')
    // Preserve dated flight instances; clock-only legacy schedules use the selected date.
    predicates.push("(departure_time LIKE ? OR TRIM(departure_time) REGEXP '^[0-9]{1,2}:[0-9]{2}([[:space:]]*(AM|PM))?$')")
    values.push(input.date+'%')
  }
  const where = predicates.length ? ' WHERE '+predicates.join(' AND ') : ''
  return {page, pageSize:12, sql:`SELECT ${flightColumns} FROM flights${where} ORDER BY flight_code LIMIT ? OFFSET ?`, values:[...values,13,(page-1)*12]}
}
export async function searchFlights(db, input) {
  const query=flightSearch(input)
  const [rows]=await db.execute(query.sql,query.values)
  return {flights:rows.slice(0,query.pageSize),page:query.page,pageSize:query.pageSize,hasNext:rows.length>query.pageSize}
}
