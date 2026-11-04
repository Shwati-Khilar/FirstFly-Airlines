import mysql from 'mysql2/promise'
import { performance } from 'node:perf_hooks'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { flightSearch } from '../lib/flight-search.js'
const c=await mysql.createConnection({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME})
try {
 const [owners]=await c.query('SELECT user_id FROM passengers WHERE user_id IS NOT NULL GROUP BY user_id ORDER BY COUNT(*) DESC LIMIT 1')
 const queries=[['allFlightsPrevious','SELECT * FROM flights',[]],
  ...[ ['origin',{from:'Delhi'}],['destination',{to:'Mumbai'}],['route',{from:'Delhi',to:'Mumbai'}],['page',{}] ].map(([name,input])=>{const q=flightSearch(input);return [name,q.sql,q.values]}),
  ['myTrips',`SELECT p.id,p.name,p.flight_id,p.seat,p.travel_class,p.price,p.pnr,p.status,
    f.current_location AS origin,f.desired_location AS destination,f.departure_time,f.arrival_time,f.flight_name
    FROM passengers p JOIN flights f ON p.flight_id=f.flight_code WHERE p.user_id=? ORDER BY p.id DESC`,[owners[0]?.user_id || 1]]]
 const measure=async()=>{
  const out={}
  for(const [name,sql,values] of queries) {
   for(let i=0;i<5;i++)await c.execute(sql,values)
   const times=[];let count=0
   for(let i=0;i<50;i++){const start=performance.now();const [rows]=await c.execute(sql,values);times.push(performance.now()-start);count=rows.length}
   times.sort((a,b)=>a-b)
   out[name]={rowsReturned:count,medianMs:+times[25].toFixed(3),p95Ms:+times[47].toFixed(3),plan:(await c.execute('EXPLAIN '+sql,values))[0].map(r=>({table:r.table,type:r.type,key:r.key,rows:r.rows,extra:r.Extra}))}
  }return out
 }
 const fingerprint=async()=>{const h=createHash('sha256');for(const t of ['flights','seats','passengers','users','bookings']){const [rows]=await c.query('SELECT * FROM '+t);h.update(JSON.stringify(rows.map(r=>JSON.stringify(r)).sort()))}return h.digest('hex')}
 const report={method:'Single local connection; mysql2 execute; 5 warmups, 50 sequential samples per query, includes row transfer; no forced indexes; unchanged data',before:await measure()}
 const original=await fingerprint()
 if(process.argv.includes('--apply')) {
  const sql=await readFile(new URL('../migrations/005-query-indexes.sql',import.meta.url),'utf8')
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await c.query(statement)
 }
 report.after=await measure();report.existingRowsUnchanged=original===await fingerprint()
 if(!report.existingRowsUnchanged)throw new Error('Records changed during measurement; inspect concurrent activity')
 await writeFile(new URL('../docs/query-performance-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report,null,2))
} finally {await c.end()}
