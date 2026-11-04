import test from 'node:test'
import assert from 'node:assert/strict'
import {scheduleParts,cityCode} from '../lib/flight-presentation.js'
test('stored IST dates render independently of machine timezone',()=>{
 const old=process.env.TZ
 try {for(const zone of ['UTC','America/Los_Angeles','Asia/Kolkata']){process.env.TZ=zone;assert.deepEqual(scheduleParts('2026-11-08 06:00'),{date:'08 Nov 2026',time:'06:00 AM'})}}
 finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old}
})
test('legacy clocks, noon, midnight, leap dates and missing schedules are explicit',()=>{
 assert.deepEqual(scheduleParts('2:00 PM'),{date:'Date not specified',time:'02:00 PM'})
 assert.equal(scheduleParts('2026-11-09 00:15').time,'12:15 AM')
 assert.equal(scheduleParts('2026-11-09 12:00').time,'12:00 PM')
 assert.equal(scheduleParts('2028-02-29 23:59').date,'29 Feb 2028')
 for(const value of ['2026-02-29 10:00','2026-11-08 24:00','13:00 PM',null,'nonsense'])assert.equal(scheduleParts(value).time,'—')
 assert.equal(cityCode(' Mumbai '),'BOM');assert.equal(cityCode('Bangalore'),'BLR')
})
