import { randomInt } from 'node:crypto'
import { HttpError, attemptId, positiveId, seatInput } from './http.js'
import { transaction } from './transaction.js'

const conflict = () => new HttpError(409, 'Seat unavailable or existing booking needs review')
const rowFirst = seat => `${seat.slice(1)}${seat[0]}`

export function createReservations(pool) {
  async function getSeat(c, input) {
    const [rows] = await c.execute(`SELECT *, lock_expiry > NOW() AS active FROM seats
      WHERE flight_id=? AND seat_number=? FOR UPDATE`, [input.flightId, input.seat])
    if (rows.length !== 1) throw new HttpError(404, 'Seat not found')
    return rows[0]
  }

  // Treat legacy row-first labels as the same physical seat. Unknown labels block
  // the flight rather than guessing which inventory can safely be sold.
  async function existingPassengers(c, input) {
    const [rows] = await c.execute(`SELECT id, user_id, status FROM passengers
      WHERE flight_id=? AND (status IS NULL OR status <> 'cancelled') AND (
        UPPER(REPLACE(TRIM(seat), ' ', '')) IN (?, ?) OR seat IS NULL OR
        UPPER(REPLACE(TRIM(seat), ' ', '')) NOT REGEXP '^([A-F]([1-9]|1[0-5])|([1-9]|1[0-5])[A-F])$')
      FOR UPDATE`, [input.flightId, input.seat, rowFirst(input.seat)])
    return rows
  }

  async function assertNoBookings(c, seat, input, exceptPassenger) {
    const passengers = await existingPassengers(c, input)
    const [legacy] = await c.execute(`SELECT id FROM bookings WHERE seat_id=?
      AND (status IS NULL OR LOWER(status) <> 'cancelled') FOR UPDATE`, [seat.id])
    if (legacy.length || passengers.some(p => p.id !== exceptPassenger)) throw conflict()
  }

  async function getAttempt(c, seat, userId, id) {
    const [rows] = await c.execute('SELECT * FROM reservation_attempts WHERE id=? FOR UPDATE', [id])
    const attempt = rows[0]
    if (!attempt || attempt.user_id !== userId || attempt.seat_id !== seat.id) throw new HttpError(409, 'Reservation does not match this request')
    return attempt
  }

  function requireActive(seat, attempt, userId) {
    if (attempt.status !== 'locked' || seat.status !== 'locked' || !seat.active ||
      seat.locked_by !== userId || seat.lock_attempt_id !== attempt.id) {
      throw new HttpError(409, 'Reservation expired or no longer active')
    }
  }

  const result = a => ({ success: true, pnr: a.pnr, bookingId: a.passenger_id, price: a.price, attemptId: a.id })

  return {
    async preparePayment(userId, body) {
      const input = seatInput(body)
      const id = attemptId(body.attemptId)
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const age = positiveId(body.age, 'age')
      if (!name || name.length > 50 || age > 120 || !['Male','Female'].includes(body.gender)) throw new HttpError(400, 'Invalid passenger details')
      return transaction(pool, async c => {
        const seat = await getSeat(c, input)
        const a = await getAttempt(c, seat, userId, id)
        requireActive(seat, a, userId)
        await assertNoBookings(c, seat, input)
        if (a.passenger_name && (a.passenger_name !== name || a.passenger_age !== age || a.passenger_gender !== body.gender)) {
          throw new HttpError(409, 'Passenger details are already fixed for this payment attempt')
        }
        if (a.order_id && !a.passenger_name) throw new HttpError(409, 'Legacy payment attempt requires review')
        const shouldCreate = a.order_state === 'none' && !a.order_id
        if (shouldCreate) await c.execute(`UPDATE reservation_attempts SET passenger_name=?,passenger_age=?,passenger_gender=?,order_state='creating' WHERE id=?`, [name,age,body.gender,id])
        return { shouldCreate, attempt: { ...a, passenger_name: a.passenger_name || name, passenger_age: a.passenger_age || age, passenger_gender: a.passenger_gender || body.gender } }
      })
    },

    async lock(userId, body) {
      const input = seatInput(body)
      const id = attemptId(body.attemptId)
      const travelClass = body.travelClass
      if (!['Business', 'Economy'].includes(travelClass)) throw new HttpError(400, 'Invalid travel class')
      if ((Number(input.seat.slice(1)) <= 3) !== (travelClass === 'Business')) throw new HttpError(400, 'Seat does not match travel class')
      return transaction(pool, async c => {
        const seat = await getSeat(c, input)
        const [previous] = await c.execute('SELECT * FROM reservation_attempts WHERE id=? FOR UPDATE', [id])
        if (previous.length) {
          const a = previous[0]
          if (a.user_id !== userId || a.seat_id !== seat.id || a.travel_class !== travelClass) throw conflict()
          requireActive(seat, a, userId)
          await assertNoBookings(c, seat, input)
          return { success: true, attemptId: id, price: a.price, expiresAt: seat.lock_expiry }
        }
        await assertNoBookings(c, seat, input)
        if (seat.status !== 'available' && !(seat.status === 'locked' && !seat.active && seat.lock_expiry)) throw conflict()
        const [flights] = await c.execute('SELECT price FROM flights WHERE flight_code=?', [input.flightId])
        const base = flights[0]?.price
        if (!Number.isSafeInteger(base) || base <= 0) throw new HttpError(409, 'Flight fare unavailable')
        const price = travelClass === 'Business' ? Math.round(base * 1.5) : base
        if (!Number.isSafeInteger(price) || price > 1000000) throw new HttpError(409, 'Flight fare unavailable')
        await c.execute(`INSERT INTO reservation_attempts (id,user_id,seat_id,travel_class,price)
          VALUES (?,?,?,?,?)`, [id, userId, seat.id, travelClass, price])
        const [updated] = await c.execute(`UPDATE seats SET status='locked', locked_by=?, lock_attempt_id=?,
          lock_expiry=NOW() + INTERVAL 5 MINUTE WHERE id=? AND
          (status='available' OR (status='locked' AND lock_expiry <= NOW()))`, [userId, id, seat.id])
        if (updated.affectedRows !== 1) throw conflict()
        const [expiry] = await c.execute('SELECT lock_expiry FROM seats WHERE id=?', [seat.id])
        return { success: true, attemptId: id, price, expiresAt: expiry[0].lock_expiry }
      })
    },

    async list(flightId) {
      flightId = positiveId(flightId, 'flight')
      // Pure read: logical expiry is sufficient. Only acquisition/release mutate
      // expired locks; no GET request or global sweep can reopen booked inventory.
      const [rows] = await pool.execute(`SELECT s.id,s.flight_id,s.seat_number,
        CASE WHEN s.status='booked' OR EXISTS (
          SELECT 1 FROM passengers p WHERE p.flight_id=s.flight_id AND (p.status IS NULL OR p.status<>'cancelled')
          AND (UPPER(REPLACE(TRIM(p.seat),' ','')) IN (s.seat_number,CONCAT(SUBSTRING(s.seat_number,2),LEFT(s.seat_number,1)))
          OR p.seat IS NULL OR UPPER(REPLACE(TRIM(p.seat),' ','')) NOT REGEXP '^([A-F]([1-9]|1[0-5])|([1-9]|1[0-5])[A-F])$'))
          OR EXISTS (SELECT 1 FROM bookings b WHERE b.seat_id=s.id AND (b.status IS NULL OR LOWER(b.status)<>'cancelled'))
        THEN 'booked' WHEN s.status='locked' AND s.lock_expiry<=NOW() THEN 'available'
        ELSE COALESCE(s.status,'booked') END AS status
        FROM seats s WHERE s.flight_id=? ORDER BY s.id`, [flightId])
      return rows
    },

    async release(userId, body) {
      const input = seatInput(body)
      const id = attemptId(body.attemptId)
      return transaction(pool, async c => {
        const seat = await getSeat(c, input)
        const a = await getAttempt(c, seat, userId, id)
        if (a.status === 'released') return { success: true, released: false }
        if (a.status !== 'locked') throw new HttpError(409, 'A finalized reservation cannot be released')
        // A delayed release from an old attempt must never release a new lock.
        if (seat.status !== 'locked' || seat.lock_attempt_id !== id || seat.locked_by !== userId) return { success: true, released: false }
        await assertNoBookings(c, seat, input)
        await c.execute(`UPDATE seats SET status='available', locked_by=NULL, lock_expiry=NULL, lock_attempt_id=NULL
          WHERE id=? AND status='locked' AND locked_by=? AND lock_attempt_id=?`, [seat.id, userId, id])
        await c.execute("UPDATE reservation_attempts SET status='released' WHERE id=?", [id])
        return { success: true, released: true }
      })
    },

    async inspect(userId, body) {
      const input = seatInput(body)
      const id = attemptId(body.attemptId)
      return transaction(pool, async c => {
        const seat = await getSeat(c, input)
        const a = await getAttempt(c, seat, userId, id)
        if (a.status !== 'confirmed') {
          requireActive(seat, a, userId)
          await assertNoBookings(c, seat, input)
        }
        return a
      })
    },

    async attachOrder(userId, body, order) {
      const input = seatInput(body)
      const id = attemptId(body.attemptId)
      return transaction(pool, async c => {
        const seat = await getSeat(c, input)
        const a = await getAttempt(c, seat, userId, id)
        requireActive(seat, a, userId)
        if (order.amount !== a.price * 100 || order.currency !== 'INR') throw new HttpError(409, 'Order amount mismatch')
        // Concurrent order requests may create an unused provider order, but only
        // the persisted order is returned/accepted for this attempt.
        if (!a.order_id) await c.execute('UPDATE reservation_attempts SET order_id=? WHERE id=?', [order.id, id])
        return { id: a.order_id || order.id, amount: a.price * 100, currency: 'INR' }
      })
    },

    async finalize(userId, body, payment) {
      const input = seatInput(body)
      const id = attemptId(body.attemptId)
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const age = positiveId(body.age, 'age')
      if (!name || name.length > 50 || age > 120 || !['Male', 'Female'].includes(body.gender)) throw new HttpError(400, 'Invalid passenger details')
      return transaction(pool, async c => {
        const seat = await getSeat(c, input)
        const a = await getAttempt(c, seat, userId, id)
        if (!a.order_id || payment.order_id !== a.order_id || payment.amount !== a.price * 100 ||
          payment.currency !== 'INR' || payment.status !== 'captured' || payment.captured !== true || payment.amount_refunded !== 0 ||
          !/^pay_[a-zA-Z0-9]+$/.test(payment.id || '')) {
          throw new HttpError(409, 'Payment is not captured for this reservation')
        }
        if (a.status === 'confirmed') {
          if (a.payment_id !== payment.id) throw new HttpError(409, 'Reservation already finalized with another payment')
          return result(a)
        }
        requireActive(seat, a, userId)
        await assertNoBookings(c, seat, input)
        const [used] = await c.execute('SELECT id FROM passengers WHERE payment_id=? LIMIT 1', [payment.id])
        if (used.length) throw new HttpError(409, 'Payment already used')
        // A unique index on the new attempt ledger is the final arbiter for races.
        let pnr
        for (let tries = 0; tries < 10; tries++) {
          const candidate = randomInt(100000, 1000000)
          const [existing] = await c.execute('SELECT id FROM passengers WHERE pnr=? LIMIT 1', [candidate])
          if (existing.length) continue
          try {
            await c.execute('UPDATE reservation_attempts SET pnr=? WHERE id=?', [candidate, id])
            pnr = candidate
            break
          } catch (err) { if (err.code !== 'ER_DUP_ENTRY') throw err }
        }
        if (!pnr) throw new HttpError(503, 'Unable to allocate booking reference; retry this attempt')
        await c.execute('UPDATE reservation_attempts SET payment_id=? WHERE id=?', [payment.id, id])
        const [insert] = await c.execute(`INSERT INTO passengers
          (name,age,gender,flight_id,price,travel_class,seat,pnr,payment_id,payment_status,user_id,status)
          VALUES (?,?,?,?,?,?,?,?,?,'SUCCESS',?,'booked')`,
        [name, age, body.gender, input.flightId, a.price, a.travel_class, input.seat, pnr, payment.id, userId])
        const [updated] = await c.execute(`UPDATE seats SET status='booked',locked_by=NULL,lock_expiry=NULL,lock_attempt_id=NULL
          WHERE id=? AND status='locked' AND locked_by=? AND lock_attempt_id=? AND lock_expiry>NOW()`, [seat.id, userId, id])
        if (updated.affectedRows !== 1) throw new HttpError(409, 'Reservation expired; payment requires review')
        await c.execute("UPDATE reservation_attempts SET status='confirmed',passenger_id=? WHERE id=?", [insert.insertId, id])
        return result({ ...a, pnr, passenger_id: insert.insertId })
      })
    },

    async cancel(userId, body) {
      const bookingId = body.bookingId === undefined ? null : positiveId(body.bookingId, 'booking')
      const pnr = bookingId ? null : positiveId(body.pnr, 'PNR')
      const [candidates] = await pool.execute(`SELECT id,flight_id,seat FROM passengers WHERE ${bookingId ? 'id' : 'pnr'}=? AND user_id=?`, [bookingId || pnr, userId])
      if (!candidates.length) throw new HttpError(404, 'Booking not found')
      if (candidates.length !== 1) throw new HttpError(409, 'Ambiguous booking; manual review required')
      const candidate = candidates[0]
      const legacySeat = typeof candidate.seat === 'string' ? candidate.seat.trim().toUpperCase().replaceAll(' ', '') : ''
      const canonical = /^\d+[A-F]$/.test(legacySeat) ? `${legacySeat.slice(-1)}${legacySeat.slice(0, -1)}` : legacySeat
      const input = seatInput({ flightId: candidate.flight_id, seat: canonical })
      if ((body.flightId !== undefined && Number(body.flightId) !== input.flightId) ||
        (body.seat !== undefined && body.seat !== candidate.seat && body.seat !== canonical)) throw new HttpError(400, 'Booking and seat do not match')
      return transaction(pool, async c => {
        const seat = await getSeat(c, input)
        const [rows] = await c.execute('SELECT * FROM passengers WHERE id=? AND user_id=? FOR UPDATE', [candidate.id, userId])
        const booking = rows[0]
        if (!booking || booking.flight_id !== input.flightId || booking.seat !== candidate.seat) throw conflict()
        if (booking.status === 'cancelled') return { success: true, status: 'cancelled' }
        await assertNoBookings(c, seat, input, booking.id)
        // Never clear someone else's live reservation to repair a legacy record.
        if (seat.status === 'locked' || !['available','booked'].includes(seat.status)) throw conflict()
        await c.execute("UPDATE passengers SET status='cancelled' WHERE id=?", [booking.id])
        await c.execute("UPDATE reservation_attempts SET status='cancelled' WHERE passenger_id=?", [booking.id])
        await c.execute("UPDATE seats SET status='available',locked_by=NULL,lock_expiry=NULL,lock_attempt_id=NULL WHERE id=?", [seat.id])
        return { success: true, status: 'cancelled', refundStatus: 'not_processed' }
      })
    }
  }
}
