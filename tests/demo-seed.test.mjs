import test from 'node:test'
import assert from 'node:assert/strict'
import { generateFlights, seatLabels, airlines } from '../scripts/seed-demo.mjs'
test('demo generator has unique realistic dated routes, fares and canonical seats',()=>{
 const flights=generateFlights('2026-12-01')
 assert.equal(flights.length,120);assert.equal(new Set(flights.map(f=>f.key)).size,120)
 assert.equal(new Set(flights.map(f=>f.id)).size,120)
 assert.equal(new Set(seatLabels).size,90)
 for(const s of seatLabels) assert.match(s,/^[A-F](?:[1-9]|1[0-5])$/)
 for(const f of flights) {
  assert.notEqual(f.from,f.to);assert.ok(f.arrival>f.departure)
  assert.ok(f.price>=2200 && f.price<15000);assert.ok(airlines.includes(f.name))
  assert.equal(f.departure.length,16)
 }
 assert.throws(()=>generateFlights('2026-02-30'))
 assert.deepEqual(flights,generateFlights('2026-12-01'))
})
