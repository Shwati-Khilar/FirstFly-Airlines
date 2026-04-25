
// import mysql from 'mysql2/promise'

// export async function GET(req) {

//   const { searchParams } = new URL(req.url)
//   const id = searchParams.get('id')

//   const db = await mysql.createConnection({
//     host: '127.0.0.1',
//     port: 3307,
//     user: 'appuser',
//     password: '1234',
//     database: 'flight_system'
//   })

//   let rows

//   if (id) {
//     // 🔍 Fetch specific flight
//     const [result] = await db.execute(
//       "SELECT * FROM flights WHERE flight_code = ?",
//       [id]
//     )
//     rows = result
//   } else {
//     // 📋 Fetch all flights
//     const [result] = await db.execute("SELECT * FROM flights")
//     rows = result
//   }

//   return Response.json(rows)
// }

import mysql from 'mysql2/promise'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    const db = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'appuser',
      password: '1234',
      database: 'flight_system'
    })

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