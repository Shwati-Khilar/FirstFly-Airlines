import test from 'node:test'
import assert from 'node:assert/strict'
import { createAuth } from '../lib/auth.js'
import { createCredentialHandler } from '../lib/credentials.js'
import { createCheckinHandler } from '../lib/checkin-handler.js'
import { createBookingHandlers } from '../lib/booking-handlers.js'
import { HttpError } from '../lib/http.js'
const req = body => new Request('http://localhost/api/auth/login',{method:'POST',body:JSON.stringify(body)})

test('all protected booking/payment writes reject anonymous identities',async()=>{
 const handlers=createBookingHandlers({auth:{requireUser:async()=>{throw new HttpError(401,'Sign in')}}})
 for(const name of ['lock','release','cancel','book','confirm','payment','reconcile']) assert.equal((await handlers[name](req({userId:1}))).status,401)
})
test('session cookies protect tokens and database stores only their hash',async()=>{
 let stored
 const auth=createAuth({execute:async(sql,args)=>{stored=args;return [[]]}})
 const response=await auth.login({id:1,name:'One'})
 const cookie=response.headers.get('set-cookie')
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Max-Age=604800/)
 assert.notEqual(stored[0],cookie.split('=')[1].split(';')[0])
 assert.equal(JSON.stringify(await response.json()).includes(stored[0]),false)
})
test('invalid registration and malformed JSON never access database',async()=>{
 const handler=createCredentialHandler({execute:()=>{throw new Error('must not query')}},true)
 assert.equal((await handler(req({email:'a@b.test',name:'',password:'12345678'}))).status,400)
 assert.equal((await handler(new Request('http://localhost',{method:'POST',body:'{'}))).status,400)
})
test('check-in denies anonymous users and scopes known booking to session owner',async()=>{
 let queried=false
 const db={execute:async(sql,args)=>{
 if(sql.includes('auth_sessions'))return [[{id:2}]]
 queried=true;assert.match(sql,/p.user_id = \?/);assert.deepEqual(args,['123456','One',2]);return [[]]
 }}
 const handler=createCheckinHandler(db)
 assert.equal((await handler(new Request('http://localhost?pnr=123456&name=One'))).status,401)
 assert.equal(queried,false)
 assert.equal((await handler(new Request('http://localhost?pnr=123456&name=One&userId=1',{headers:{cookie:'firstfly_session='+'a'.repeat(64)}}))).status,404)
 assert.equal(queried,true)
})
