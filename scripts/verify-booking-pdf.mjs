import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
import {createBookingPdf,bookingQrPayload} from '../lib/booking-pdf.js'
mkdirSync('output/pdf',{recursive:true});mkdirSync('tmp/pdfs',{recursive:true})
const fonts={serif:readFileSync('public/pdf-fonts/CormorantGaramond-Regular.ttf').toString('base64'),sans:readFileSync('public/pdf-fonts/DMSans-Regular.ttf').toString('base64')}
// Existing integration fixture passenger/class/fare; synthetic booking references.
const base={status:'booked',name:'Test Passenger',flight_id:1,flight_name:'FirstFly',seat:'A4',travel_class:'Economy',price:5000,pnr:123456,origin:'Delhi',destination:'Mumbai',departure_time:'10:00 AM',arrival_time:'12:00 PM'}
const cases=[base,{...base,name:'Alexandra Catherine Montgomery-Wellington',flight_id:900120,flight_name:'Air India Express',seat:'F15',pnr:987654,origin:'Bhubaneswar',destination:'Bangalore',departure_time:'2026-11-08 23:30',arrival_time:'2026-11-09 01:45'},{...base,name:'José Álvarez',flight_id:900001,seat:'B1',travel_class:'Business',price:7500,pnr:654321}]
for(const [i,booking] of cases.entries()){const pdf=createBookingPdf(booking,fonts);assert.equal(pdf.getNumberOfPages(),1);writeFileSync(`output/pdf/firstfly-test-${i+1}.pdf`,Buffer.from(pdf.output('arraybuffer')))}
writeFileSync('tmp/pdfs/expected.json',JSON.stringify(cases.map(b=>({name:b.name,pnr:b.pnr,payload:bookingQrPayload(b)}))))
console.log('3 vector PDFs generated from test fixtures')
