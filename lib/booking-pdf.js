import { jsPDF } from 'jspdf'
import QRCode from 'qr.js/lib/QRCode.js'
import ErrorCorrectLevel from 'qr.js/lib/ErrorCorrectLevel.js'
import {cityCode,scheduleParts} from './flight-presentation.js'

export function bookingQrPayload(booking) {
  return `PNR:${booking.pnr}|Name:${booking.name}|Flight:${booking.flight_id}|Seat:${booking.seat}`
}
// fonts are base64 TTF bytes, supplied from local assets in the browser or tests.
export function createBookingPdf(booking, fonts) {
  if (!booking || booking.status !== 'booked' || !booking.name || !booking.pnr || !booking.flight_id || !booking.seat || !booking.travel_class || !Number.isFinite(booking.price)) throw new Error('A verified active booking is required')
  const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:[250,160],compress:true,putOnlyUsedFonts:true})
  for(const [name,data] of [['Cormorant',fonts.serif],['DMSans',fonts.sans]]) {
    if(!data)throw new Error('PDF font unavailable')
    pdf.addFileToVFS(name+'.ttf',data);pdf.addFont(name+'.ttf',name,'normal')
  }
  const cream='#f0ebe0',ink='#1a1a1a',muted='#696257',pale='#f8f6f2'
  const fill=(color,x,y,w,h,r=0)=>{
    pdf.setFillColor(color)
    if(r)pdf.roundedRect(x,y,w,h,r,r,'F')
    else pdf.rect(x,y,w,h,'F')
  }
  const text=(value,x,y,{font='DMSans',size=10,color=ink,align='left',width=150,lines=1}={})=>{
    pdf.setFont(font,'normal');pdf.setTextColor(color)
    let chunks
    for(;size>=7;size-=.5){pdf.setFontSize(size);chunks=pdf.splitTextToSize(String(value),width);if(chunks.length<=lines && String(value).split(/\s+/).every(word=>pdf.getTextWidth(word)<=width))break}
    if(chunks.length>lines)throw new Error('Booking text exceeds PDF layout capacity')
    pdf.text(chunks,x,y,{align,lineHeightFactor:1.15})
  }
  const label=(v,x,y,options={})=>text(v.toUpperCase(),x,y,{size:7,color:muted,...options})
  const qr=(payload,x,y,size)=>{
    const q=new QRCode(-1,ErrorCorrectLevel.M)
    q.addData(Array.from(new TextEncoder().encode(payload),b=>String.fromCharCode(b)).join(''));q.make()
    const n=q.modules.length,unit=size/(n+8)
    fill('#ffffff',x,y,size,size)
    pdf.setFillColor(ink)
    q.modules.forEach((row,r)=>row.forEach((dark,c)=>{if(dark)pdf.rect(x+(c+4)*unit,y+(r+4)*unit,unit,unit,'F')}))
  }
  fill(cream,0,0,250,160)
  // Six-millimetre page margins leave room for typical printer non-printable edges.
  fill('#ffffff',6,6,238,148,5)
  fill(ink,184,6,60,148,5);fill(ink,184,6,5,148)
  pdf.setDrawColor('#c8bfb0');pdf.setLineWidth(.35);pdf.setLineDashPattern([1.2,1.4],0);pdf.line(182,13,182,147);pdf.setLineDashPattern([],0)
  label('Passenger',20,22)
  text(booking.name,20,31,{font:'Cormorant',size:23,width:92,lines:2})
  label('Flight',172,22,{align:'right'})
  text(booking.flight_name || 'FirstFly',172,30,{font:'Cormorant',size:16,align:'right',width:54,lines:2})
  text('#'+booking.flight_id,172,42,{size:10,align:'right',width:54})
  fill(pale,20,50,152,35,3)
  for(const [city,schedule,x] of [[booking.origin,booking.departure_time,53],[booking.destination,booking.arrival_time,139]]){
    text(cityCode(city),x,62,{font:'Cormorant',size:31,align:'center',width:54})
    text(city || 'Unknown',x,68,{size:11,align:'center',width:58})
    const parts=scheduleParts(schedule)
    text(parts.date,x,74,{size:9,align:'center',width:58})
    text(parts.time+' IST',x,80,{size:11,align:'center',width:58})
  }
  pdf.setDrawColor('#c8bfb0');pdf.setLineWidth(.3);pdf.line(86,64,106,64);pdf.line(103,62,106,64);pdf.line(103,66,106,64)
  // No invented duration or connection status is added to the exported document.
  const payload=bookingQrPayload(booking)
  qr(payload,79,90,34)
  const fields=[['Seat',booking.seat],['Class',booking.travel_class],['Price','₹'+booking.price.toLocaleString('en-IN')],['PNR',booking.pnr]]
  fields.forEach(([key,value],i)=>{const x=20+i*39;fill(pale,x,130,35,14,2);label(key,x+17.5,135,{align:'center'});text(value,x+17.5,141,{font:'Cormorant',size:15,width:31,align:'center'})})
  const center=214
  text('FIRSTFLY',center,23,{size:11,color:cream,align:'center',width:46})
  label('Passenger',center,34,{color:'#c8bfb0',align:'center'})
  text(booking.name,center,41,{font:'Cormorant',size:16,color:cream,align:'center',width:44,lines:3})
  label('Flight',center,61,{color:'#c8bfb0',align:'center'})
  text('#'+booking.flight_id,center,68,{font:'Cormorant',size:16,color:cream,align:'center',width:44})
  label('Seat',center,79,{color:'#c8bfb0',align:'center'})
  text(booking.seat,center,88,{font:'Cormorant',size:24,color:cream,align:'center',width:44})
  label('Class',center,97,{color:'#c8bfb0',align:'center'})
  text(booking.travel_class,center,104,{font:'Cormorant',size:15,color:cream,align:'center',width:44})
  qr(payload,197,110,34)
  pdf.setProperties({title:`FirstFly Booking ${booking.pnr}`,subject:'Booking confirmation',creator:'FirstFly'})
  return pdf
}

export async function downloadBookingPdf(booking) {
  const load=async name=>{
    const response=await fetch('/pdf-fonts/'+name+'.ttf')
    if(!response.ok)throw new Error('Unable to load PDF fonts')
    const bytes=new Uint8Array(await response.arrayBuffer())
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192))
    return btoa(binary)
  }
  const [serif,sans]=await Promise.all([load('CormorantGaramond-Regular'),load('DMSans-Regular')])
  createBookingPdf(booking,{serif,sans}).save(`FirstFly_Booking_${booking.pnr}.pdf`)
}
