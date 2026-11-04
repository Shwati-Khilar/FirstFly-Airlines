// Stored schedules are Asia/Kolkata wall-clock strings, not UTC instants.
// Parse components explicitly so server/browser timezone cannot shift a date.
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
export function scheduleParts(value) {
  const text=typeof value==='string'?value.trim():''
  const dated=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/.exec(text)
  let date='Date not specified',hour,minute
  if(dated){
    const [,y,m,d,h,min]=dated
    const check=new Date(Date.UTC(+y,+m-1,+d))
    if(check.getUTCFullYear()!==+y || check.getUTCMonth()!==+m-1 || check.getUTCDate()!==+d)return {date:'Schedule unavailable',time:'—'}
    date=`${d} ${months[+m-1]} ${y}`;hour=+h;minute=+min
  }else{
    const clock=/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(text)
    if(!clock)return {date:'Schedule unavailable',time:'—'}
    hour=+clock[1];minute=+clock[2]
    if(clock[3]){if(hour<1||hour>12)return {date:'Schedule unavailable',time:'—'};hour=hour%12+(clock[3].toUpperCase()==='PM'?12:0)}
  }
  if(hour>23||minute>59)return {date:'Schedule unavailable',time:'—'}
  return {date,time:`${String(hour%12||12).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`}
}
export function cityCode(city){
 const codes={lucknow:'LKO',delhi:'DEL',mumbai:'BOM',bangalore:'BLR',chennai:'MAA',kolkata:'CCU',hyderabad:'HYD',ahmedabad:'AMD',pune:'PNQ',goa:'GOI',jaipur:'JAI',kochi:'COK',bhubaneswar:'BBI'}
 return codes[String(city||'').trim().toLowerCase()] || '—'
}
