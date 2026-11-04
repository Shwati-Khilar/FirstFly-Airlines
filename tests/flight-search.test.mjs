import test from 'node:test'
import assert from 'node:assert/strict'
import { flightSearch, searchFlights } from '../lib/flight-search.js'
test('flight pagination validates inputs and parameterizes filters',()=>{
 const q=flightSearch({from:' Delhi ',to:'Mumbai',page:'2'})
 assert.match(q.sql,/current_location=\? AND desired_location=\?/)
 assert.deepEqual(q.values,['Delhi','Mumbai',13,12])
 for(const page of ['0','-1','1.5','100001','abc'])assert.throws(()=>flightSearch({page}))
 assert.throws(()=>flightSearch({to:['Delhi']}))
 assert.deepEqual(flightSearch({to:"x' OR 1=1"}).values,["x' OR 1=1",13,0])
})
test('one-row lookahead bounds pages and identifies the final page',async()=>{
 const db={execute:async()=>[Array.from({length:13},(_,i)=>({flight_code:i+1}))]}
 const page=await searchFlights(db,{})
 assert.equal(page.flights.length,12);assert.equal(page.hasNext,true)
 assert.equal((await searchFlights({execute:async()=>[[]]},{page:2})).hasNext,false)
})
