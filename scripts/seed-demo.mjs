import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

// Recognizable airline labels on illustrative schedules, not real airline timetables.
const cities = [
  ['Delhi',28.6,77.2],['Mumbai',19.1,72.9],['Bangalore',13.0,77.6],
  ['Chennai',13.1,80.3],['Kolkata',22.6,88.4],['Hyderabad',17.4,78.5],
  ['Ahmedabad',23.0,72.6],['Pune',18.5,73.9],['Goa',15.4,73.8],
  ['Jaipur',26.9,75.8],['Kochi',10.0,76.3],['Bhubaneswar',20.3,85.8]
]
export const airlines = ['IndiGo','Air India','Air India Express','SpiceJet','Akasa Air']
const legacyAirlines = ['DEMO Skyline Air','DEMO Coastal Airways','DEMO Horizon Air','DEMO Meridian Airlines']
export const seatLabels = Array.from({length:15},(_,i)=>[...'ABCDEF'].map(c=>c+(i+1))).flat()
export function generateFlights(startDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || new Date(startDate+'T00:00:00Z').toISOString().slice(0,10)!==startDate) throw new Error('Use a valid YYYY-MM-DD start date')
  const start = Date.parse(startDate+'T00:00:00Z')
  const stamp = ms => new Date(ms).toISOString().slice(0,16).replace('T',' ')
  return Array.from({length:120},(_,i)=>{
    const origin=cities[i%12], destination=cities[(i%12+1+Math.floor(i/12))%12]
    const rad=n=>n*Math.PI/180
    const a=Math.sin(rad(destination[1]-origin[1])/2)**2 + Math.cos(rad(origin[1]))*Math.cos(rad(destination[1]))*Math.sin(rad(destination[2]-origin[2])/2)**2
    const km=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
    const duration=Math.ceil((35+km/700*60)/5)*5
    const departure=start+Math.floor(i/12)*86400000+(6+(i%12))*3600000+(i%4)*15*60000
    return {key:`firstfly-demo-v1-${i+1}`,id:900001+i,name:airlines[i%airlines.length],from:origin[0],to:destination[0],
      departure:stamp(departure),arrival:stamp(departure+duration*60000),price:Math.round((2200+km*3.4+(i%5)*250)/100)*100}
  })
}
export async function seedDemo(c, startDate) {
  const [lock]=await c.execute("SELECT GET_LOCK('firstfly-demo-v1',10) acquired")
  if(lock[0].acquired!==1) throw new Error('Another demo seed is running')
  let inserted=0, renamed=0
  try {
    await c.query(await readFile(new URL('../migrations/004-demo-flights.sql',import.meta.url),'utf8'))
    await c.beginTransaction()
    try {
      for(const f of generateFlights(startDate)) {
        const [registered]=await c.execute('SELECT flight_code FROM demo_flights WHERE seed_key=?',[f.key])
        if(registered.length) {
          if(registered[0].flight_code!==f.id) throw new Error('Seed registry mismatch')
          // Rename only this registry-owned row's original generated label.
          // Preserve custom labels, IDs, schedules, fares and all seat/booking data.
          const index=f.id-900001
          const [change]=await c.execute('UPDATE flights SET flight_name=? WHERE flight_code=? AND flight_name=?',[f.name,f.id,legacyAirlines[index%4]])
          renamed+=change.affectedRows
          continue
        }
        const [collision]=await c.execute('SELECT flight_code FROM flights WHERE flight_code=?',[f.id])
        if(collision.length) throw new Error(`Flight ID ${f.id} is already in use; no existing flight was overwritten`)
        await c.execute(`INSERT INTO flights (flight_code,flight_name,current_location,desired_location,departure_time,arrival_time,price,status)
          VALUES (?,?,?,?,?,?,?,'Scheduled')`,[f.id,f.name,f.from,f.to,f.departure,f.arrival,f.price])
        await c.execute('INSERT INTO demo_flights (seed_key,flight_code,departure_at,arrival_at) VALUES (?,?,?,?)',[f.key,f.id,f.departure,f.arrival])
        await c.query('INSERT INTO seats (flight_id,seat_number,status) VALUES ?', [seatLabels.map(seat=>[f.id,seat,'available'])])
        inserted++
      }
      await c.commit()
    } catch(err) { await c.rollback(); throw err }
    const [counts]=await c.query(`SELECT (SELECT COUNT(*) FROM flights) flights,
      (SELECT COUNT(*) FROM seats) seats, (SELECT COUNT(*) FROM demo_flights) demo_flights,
      (SELECT COUNT(*) FROM seats s JOIN demo_flights d ON d.flight_code=s.flight_id) demo_seats`)
    return {inserted,renamed,...counts[0]}
  } finally { await c.execute("SELECT RELEASE_LOCK('firstfly-demo-v1')") }
}
async function main() {
  const startDate=process.argv[2] || new Date(Date.now()+7*86400000).toISOString().slice(0,10)
  const c=await mysql.createConnection({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME})
  try { console.log(await seedDemo(c,startDate)) } finally { await c.end() }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(err=>{
  console.error('Demo seed failed:',err.code || err.message);process.exitCode=1
})
