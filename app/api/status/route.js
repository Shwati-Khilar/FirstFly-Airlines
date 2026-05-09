import mysql from 'mysql2/promise'
import db from '@/lib/db'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const flight = searchParams.get('flight')


  const [rows] = await db.execute(
    "SELECT status FROM flights WHERE flight_code = ?",
    [flight]
  )

  return Response.json(rows[0])
}