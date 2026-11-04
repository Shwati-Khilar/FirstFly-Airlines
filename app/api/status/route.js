import db from '@/lib/db'
import { positiveId, errorResponse, HttpError } from '@/lib/http'
export async function GET(req) {
  try {
    const flight = positiveId(new URL(req.url).searchParams.get('flight'), 'flight')
    const [rows] = await db.execute('SELECT status FROM flights WHERE flight_code=?', [flight])
    if (!rows.length) throw new HttpError(404, 'Flight not found')
    return Response.json(rows[0], {headers:{'Cache-Control':'no-store'}})
  } catch (err) { return errorResponse(err) }
}
