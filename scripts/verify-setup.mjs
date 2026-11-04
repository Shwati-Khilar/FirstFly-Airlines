import mysql from 'mysql2/promise'
import {randomUUID,randomBytes} from 'node:crypto'
import assert from 'node:assert/strict'
import {migrate} from './reservations-db.mjs'
import {seedDemo} from './seed-demo.mjs'
import {createCredentialHandler} from '../lib/credentials.js'
import {createAuth} from '../lib/auth.js'
import {createBookingHandlers} from '../lib/booking-handlers.js'
import {createReservations} from '../lib/reservations.js'
const database='firstfly_setup_'+randomUUID().replaceAll('-','')
const settings={host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD}
let admin,pool,created=false
try {
 if(!['localhost','127.0.0.1','::1'].includes(settings.host))throw new Error('Local MariaDB required')
 admin=await mysql.createConnection(settings)
 await admin.query(`CREATE DATABASE \`${database}\``);created=true
 pool=mysql.createPool({...settings,database})
 await migrate(pool);await migrate(pool)
 const seedConnection=await pool.getConnection()
 let first,second
 try { first=await seedDemo(seedConnection,'2030-01-01');second=await seedDemo(seedConnection,'2030-01-01') } finally { seedConnection.release() }
 assert.equal(first.flights,120);assert.equal(first.seats,10800);assert.equal(second.inserted,0)
 const request=(body,cookie)=>new Request('http://localhost/api',{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)})
 const registration=await createCredentialHandler(pool,true)(request({name:'Setup fixture',email:'setup@example.test',password:randomBytes(16).toString('hex')}))
 assert.equal(registration.status,200)
 const cookie=registration.headers.get('set-cookie').split(';')[0]
 const handlers=createBookingHandlers({auth:createAuth(pool),reservations:createReservations(pool)})
 const body={flightId:900001,seatNumber:'A4',travelClass:'Economy',attemptId:randomUUID()}
 assert.equal((await handlers.lock(request(body,cookie))).status,200)
 assert.equal((await handlers.release(request(body,cookie))).status,200)
 const [tables]=await pool.query('SHOW TABLES')
 console.log({cleanSetup:'passed',tables:tables.length,seededFlights:first.flights,seats:first.seats,registrationSessionLockRelease:'passed',seedRerun:'no duplicates'})
}finally{
 if(pool)await pool.end()
 if(admin){try{if(created){assert.match(database,/^firstfly_setup_[a-f0-9]{32}$/);assert.notEqual(database,process.env.DB_NAME);await admin.query(`DROP DATABASE \`${database}\``);console.log('Temporary setup database removed')}}finally{await admin.end()}}
}
