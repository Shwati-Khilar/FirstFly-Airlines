import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { createAuth } from '../lib/auth.js'
import { createCredentialHandler } from '../lib/credentials.js'
import { createReservations } from '../lib/reservations.js'
import { createBookingHandlers } from '../lib/booking-handlers.js'
import { migrate } from './reservations-db.mjs'

// No caller-supplied database or URL: all writes go to this freshly created DB.
const database = 'firstfly_bench_' + randomUUID().replaceAll('-', '')
const sourceDatabase = process.env.DB_NAME
const settings = { host:process.env.DB_HOST, port:process.env.DB_PORT,
  user:process.env.DB_USER, password:process.env.DB_PASSWORD }
let admin, pool, server, created = false
let report
const started = performance.now()
try {
  if (!['localhost','127.0.0.1','::1'].includes(settings.host)) throw new Error('Benchmark requires local MariaDB')
  if (!sourceDatabase) throw new Error('DB_NAME is required to inspect the existing schema')
  admin = await mysql.createConnection({...settings, database:sourceDatabase})
  // Copy schema only, including indexes and foreign keys, never customer rows.
  const definitions=[]
  for (const table of ['users','flights','seats','passengers','bookings']) {
    const [rows]=await admin.query('SHOW CREATE TABLE '+table)
    definitions.push(rows[0]['Create Table'])
  }
  await admin.query(`CREATE DATABASE \`${database}\``)
  created=true
  pool=mysql.createPool({...settings,database,connectionLimit:10,waitForConnections:true})
  for(const ddl of definitions) await pool.query(ddl)
  await migrate(pool)
  const password=randomBytes(24).toString('hex')
  const email='benchmark@example.test'
  const [account]=await pool.execute('INSERT INTO users (name,email,password) VALUES (?,?,?)',
    ['Concurrency benchmark',email,await bcrypt.hash(password,10)])
  await pool.execute(`INSERT INTO flights (flight_code,flight_name,current_location,desired_location,departure_time,arrival_time,price,status)
    VALUES (1,'BENCHMARK ONLY','Delhi','Mumbai','2030-01-01 10:00','2030-01-01 12:00',5000,'Scheduled')`)
  await pool.execute("INSERT INTO seats (flight_id,seat_number,status) VALUES (1,'A4','available')")
  const auth=createAuth(pool)
  const login=createCredentialHandler(pool)
  const {lock}=createBookingHandlers({auth,reservations:createReservations(pool)})
  let origin
  server=createServer(async (incoming,outgoing)=>{
    try {
      const chunks=[]
      for await (const chunk of incoming) chunks.push(chunk)
      const request=new Request(origin+incoming.url,{method:incoming.method,headers:incoming.headers,body:Buffer.concat(chunks)})
      const handler=incoming.url==='/api/auth/login'?login:incoming.url==='/api/seats/lock'?lock:null
      const response=handler?await handler(request):new Response(null,{status:404})
      outgoing.writeHead(response.status,Object.fromEntries(response.headers))
      outgoing.end(Buffer.from(await response.arrayBuffer()))
    } catch { outgoing.writeHead(500);outgoing.end('Benchmark transport failure') }
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  origin='http://127.0.0.1:'+server.address().port
  const post=(path,body,cookie)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)})
  const anonymous=await post('/api/seats/lock',{flightId:1,seatNumber:'A4',travelClass:'Economy',attemptId:randomUUID()})
  assert.equal(anonymous.status,401,'Anonymous request must be rejected')
  const signedIn=await post('/api/auth/login',{email,password})
  assert.equal(signedIn.status,200,'Benchmark login failed')
  const cookie=signedIn.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie?.startsWith('firstfly_session='),'Missing authenticated session')
  const attempts=Array.from({length:20},()=>randomUUID())
  const start=performance.now()
  const results=await Promise.all(attempts.map(async attemptId=>{
    try {
      const response=await post('/api/seats/lock',{flightId:1,seatNumber:'A4',travelClass:'Economy',attemptId},cookie)
      return {status:response.status,body:await response.json(),attemptId}
    } catch {return {status:0,attemptId}}
  }))
  const elapsedMs=Number((performance.now()-start).toFixed(2))
  const winners=results.filter(r=>r.status===200 && r.body?.success===true && r.body.attemptId===r.attemptId)
  const conflicts=results.filter(r=>r.status===409 && typeof r.body?.error==='string')
  report={totalRequests:20,successfulReservations:winners.length,rejectedConflicts:conflicts.length,
    unexpectedErrors:20-winners.length-conflicts.length,executionMs:elapsedMs}
  const [seats]=await pool.query('SELECT *,lock_expiry>NOW() active FROM seats')
  const [reservations]=await pool.query('SELECT * FROM reservation_attempts')
  const [counts]=await pool.query(`SELECT (SELECT COUNT(*) FROM passengers) passengers,
    (SELECT COUNT(*) FROM bookings) bookings,(SELECT COUNT(*) FROM payment_records) payments`)
  report.database={reservationAttempts:reservations.length,...counts[0]}
  assert.equal(winners.length,1,'Exactly one request should acquire the free seat')
  assert.equal(conflicts.length,19,'All remaining requests must return 409')
  assert.equal(report.unexpectedErrors,0)
  assert.equal(seats.length,1);assert.equal(reservations.length,1)
  assert.equal(seats[0].status,'locked');assert.equal(seats[0].active,1)
  assert.equal(seats[0].locked_by,account.insertId)
  assert.equal(seats[0].lock_attempt_id,winners[0].attemptId)
  assert.equal(reservations[0].id,winners[0].attemptId)
  assert.equal(reservations[0].seat_id,seats[0].id)
  assert.equal(reservations[0].user_id,account.insertId)
  assert.equal(reservations[0].status,'locked')
  assert.equal(reservations[0].order_id,null);assert.equal(reservations[0].payment_id,null)
  assert.equal(reservations[0].passenger_id,null)
  assert.deepEqual(counts[0],{passengers:0,bookings:0,payments:0})
  report.consistent=true
} catch(err) {
  if(report) console.log(JSON.stringify(report,null,2))
  console.error('Benchmark failed:',err.code || err.message)
  process.exitCode=1
} finally {
  // Wait for HTTP work to drain before closing DB connections or dropping data.
  if(server?.listening) await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections()})
  if(pool) await pool.end()
  if(admin) {
    try {
      if(created) {
        assert.match(database,/^firstfly_bench_[a-f0-9]{32}$/)
        assert.notEqual(database,sourceDatabase)
        await admin.query(`DROP DATABASE \`${database}\``)
        const [remaining]=await admin.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[database])
        assert.equal(remaining.length,0,'Cleanup verification failed')
        if(report) report.cleanupVerified=true
      }
    } finally {await admin.end()}
  }
}
if(report?.consistent) console.log(JSON.stringify({...report,totalRunMs:Number((performance.now()-started).toFixed(2))},null,2))
