import test from 'node:test'
import assert from 'node:assert/strict'
import {flightCardSchedule,validTravelDate} from '../lib/flight-card-schedule.js'
import {flightSearch} from '../lib/flight-search.js'

test('cards require a valid selected calendar date',()=>{
  for(const date of ['',undefined,'2026-02-29','2026-13-01','2026-1-01']) {
    assert.equal(validTravelDate(date),false)
    assert.equal(flightCardSchedule({},date),null)
  }
  assert.equal(flightCardSchedule({departure_time:'bad',arrival_time:'12:00'},'2026-11-08'),null)
})
test('selected dates and overnight rollover are timezone independent',()=>{
  const previous=process.env.TZ
  try {for(const zone of ['UTC','Asia/Kolkata','America/Los_Angeles']) {
    process.env.TZ=zone
    for(const [date,dep,arr,expected] of [
      ['2026-11-08','06:00 AM','08:15 AM','08 Nov 2026'],
      ['2026-11-08','11:30 PM','01:45 AM','09 Nov 2026'],
      ['2026-12-31','23:30','00:15','01 Jan 2027'],
      ['2028-02-28','23:30','00:15','29 Feb 2028'],
      ['2026-11-08','2026-11-08 23:30','2026-11-09 01:45','09 Nov 2026']
    ]) {
      const value=flightCardSchedule({departure_time:dep,arrival_time:arr},date)
      assert.equal(value.arrival.date,expected)
      assert.notEqual(value.departure.date,'Date not specified')
      if(date==='2026-11-08')assert.equal(value.departure.date,'08 Nov 2026')
    }
  }} finally {if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous}
})
test('date filtering is parameterized before pagination and rejects invalid dates',()=>{
  const query=flightSearch({date:'2026-11-08',to:'Mumbai',page:'2'})
  assert.deepEqual(query.values,['Mumbai','2026-11-08%',13,12])
  assert.match(query.sql,/departure_time LIKE \?/)
  assert.match(query.sql,/REGEXP/)
  for(const date of ['','2026-02-29',[]])assert.throws(()=>flightSearch({date}))
})
