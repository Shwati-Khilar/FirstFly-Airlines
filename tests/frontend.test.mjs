import test from 'node:test'
import assert from 'node:assert/strict'
import { filterFlights, seatClass, verifiedBooking, filterTrips } from '../lib/frontend-model.js'
test('flight search supports destination, origin, both and normalized input',()=>{
 const flights=[{current_location:' Delhi ',desired_location:'Mumbai'},{current_location:'Chennai',desired_location:'Delhi'}]
 assert.deepEqual(filterFlights(flights,'',' MUMBAI '),[flights[0]])
 assert.deepEqual(filterFlights(flights,'Chennai',''),[flights[1]])
 assert.deepEqual(filterFlights(flights,'Delhi','Delhi'),[])
 assert.equal(filterFlights(flights).length,2)
})
test('canonical seat labels map to the server cabin boundaries',()=>{
 for(const col of 'ABCDEF') for(let row=1;row<=15;row++) assert.equal(seatClass(col+row),row<=3?'Business':'Economy')
 for(const seat of ['1A','A0','A16','G1','A01','']) assert.equal(seatClass(seat),null)
})
test('confirmation resolves only an active verified booking and trips preserve unknown history',()=>{
 const bookings=[{pnr:123456,status:'booked'},{pnr:234567,status:'cancelled'},{pnr:345678,status:null}]
 assert.equal(verifiedBooking(bookings,'123456'),bookings[0])
 assert.equal(verifiedBooking(bookings,'234567'),null)
 assert.equal(verifiedBooking(bookings,'999999'),null)
 assert.deepEqual(filterTrips(bookings,'active'),[bookings[0]])
 assert.deepEqual(filterTrips(bookings,'cancelled'),[bookings[1]])
 assert.equal(filterTrips(bookings,'history').length,3)
})
