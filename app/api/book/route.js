import db from '@/lib/db'

export async function POST(req) {
  try {
    const body = await req.json()

    const {
      name,
      age,
      gender,
      travelClass,
      flight_id,
      price,
      seat,
      payment_id,
      user_id
    } = body

    const pnr = Math.floor(100000 + Math.random() * 900000)

    await db.query(
      `INSERT INTO passengers 
      (name, age, gender, flight_id, price, travel_class, seat, pnr, payment_id, payment_status, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        age,
        gender,
        flight_id,
        price,
        travelClass,
        seat,
        pnr,
        payment_id,
        "SUCCESS",
        user_id
      ]
    )

    return Response.json({ pnr })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}