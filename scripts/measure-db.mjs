import mysql from 'mysql2/promise'
import { writeFile } from 'node:fs/promises'
const label=process.argv[2]
if(!['before','after'].includes(label)) throw new Error('Use before or after')
const db=await mysql.createConnection({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME})
try {
 const [owners]=await db.query('SELECT user_id FROM passengers WHERE user_id IS NOT NULL GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1')
 const columns='flight_code,flight_name,current_location,desired_location,departure_time,arrival_time,price,status'
 const cases={
  destination:{sql:`SELECT ${columns} FROM flights WHERE desired_location=? ORDER BY flight_code LIMIT 13 OFFSET 0`,args:['Mumbai']},
  route:{sql:`SELECT ${columns} FROM flights WHERE current_location=? AND desired_location=? ORDER BY flight_code LIMIT 13 OFFSET 0`,args:['Delhi','Mumbai']},
  trips:{sql:'SELECT p.id,p.name,p.flight_id,p.seat,p.travel_class,p.price,p.pnr,p.status,f.flight_name FROM passengers p JOIN flights f ON f.flight_code=p.flight_id WHERE p.user_id=? ORDER BY p.id DESC',args:[owners[0]?.user_id || 1]},
  oldFlightList:{sql:'SELECT * FROM flights',args:[]}
 }
 const report={label,method:'One local connection; 10 warmups then 100 sequential client-wall-clock samples per query; milliseconds; includes transport/row decoding, excludes connection setup; no concurrent load',counts:(await db.query('SELECT (SELECT COUNT(*) FROM flights) flights,(SELECT COUNT(*) FROM seats) seats,(SELECT COUNT(*) FROM passengers) passengers'))[0][0],queries:{}}
 for(const [name,{sql,args}] of Object.entries(cases)) {
  for(let i=0;i<10;i++) await db.query(sql,args)
  const samples=[];let rows
  for(let i=0;i<100;i++){const start=performance.now();[rows]=await db.query(sql,args);samples.push(performance.now()-start)}
  samples.sort((a,b)=>a-b)
  report.queries[name]={sql,rows:rows.length,medianMs:+samples[50].toFixed(3),p95Ms:+samples[94].toFixed(3),explain:(await db.query('EXPLAIN '+sql,args))[0]}
 }
 await writeFile(new URL(`../docs/db-performance-${label}.json`,import.meta.url),JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report,null,2))
} finally {await db.end()}
