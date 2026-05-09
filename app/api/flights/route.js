
import db from '@/lib/db'
import mysql from 'mysql2/promise'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')


    const query = id
      ? "SELECT * FROM flights WHERE flight_code = ?"
      : "SELECT * FROM flights"

    const [rows] = id
      ? await db.execute(query, [id])
      : await db.execute(query)

    return Response.json(rows)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}