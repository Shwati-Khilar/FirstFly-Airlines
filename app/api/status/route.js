import mysql from 'mysql2/promise'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const flight = searchParams.get('flight')

  const db = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'appuser',
    password: '1234',
    database: 'flight_system'
  })

  const [rows] = await db.execute(
    "SELECT status FROM flights WHERE flight_code = ?",
    [flight]
  )

  return Response.json(rows[0])
}