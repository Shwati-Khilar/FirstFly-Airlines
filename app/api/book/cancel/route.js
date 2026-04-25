import db from '@/lib/db'

export async function POST(req) {
  try {
    const { pnr, seat, flightId } = await req.json()

    // 1️⃣ Free the seat
    await db.query(
      `UPDATE seats 
       SET status='available', locked_by=NULL, lock_expiry=NULL
       WHERE seat_number=? AND flight_id=?`,
      [seat, flightId]
    )

    // 2️⃣ Delete booking
    await db.query(
      `DELETE FROM passengers WHERE pnr=?`,
      [pnr]
    )

    return Response.json({ success: true })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}