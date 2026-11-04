import db from '@/lib/db'
import { positiveId, errorResponse } from '@/lib/http'
import { flightColumns, searchFlights } from '@/lib/flight-search'
export async function GET(req) {
  try {
    const params=new URL(req.url).searchParams
    const id=params.get('id')
    const result=id===null ? await searchFlights(db,Object.fromEntries(params)) : null
    const rows=result ? result.flights : (await db.execute(`SELECT ${flightColumns} FROM flights WHERE flight_code=?`,[positiveId(id,'flight')]))[0]
    return Response.json(rows.map(f=>({...f,fares:Number.isInteger(f.price)&&f.price>0?{Economy:f.price,Business:Math.round(f.price*1.5)}:null})),
      {headers:{'Cache-Control':'no-store',...(result?{'X-Page':String(result.page),'X-Page-Size':String(result.pageSize),'X-Has-Next':String(result.hasNext)}:{})}})
  } catch(err) {return errorResponse(err)}
}
