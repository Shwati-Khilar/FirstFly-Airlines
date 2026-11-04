import { HttpError, attemptId, seatInput } from './http.js'
import { transaction } from './transaction.js'

const selectAttempt = `SELECT a.*,s.flight_id,s.seat_number,
  COALESCE(a.passenger_name,p.name) AS passenger_name,
  COALESCE(a.passenger_age,p.age) AS passenger_age,
  COALESCE(a.passenger_gender,p.gender) AS passenger_gender
  FROM reservation_attempts a JOIN seats s ON s.id=a.seat_id
  LEFT JOIN passengers p ON p.id=a.passenger_id`

export function createPaymentStore(pool) {
  async function get(id) {
    const [rows] = await pool.execute(`${selectAttempt} WHERE a.id=?`, [attemptId(id)])
    if (!rows.length) throw new HttpError(404, 'Payment attempt not found')
    return rows[0]
  }
  return {
    get,
    async payment(id) { return (await pool.execute('SELECT * FROM payment_records WHERE payment_id=?', [id]))[0][0] || null },
    async owned(userId, body) {
      const input = seatInput(body)
      const a = await get(body.attemptId)
      if (a.user_id !== userId || a.flight_id !== input.flightId || a.seat_number !== input.seat) throw new HttpError(404, 'Payment attempt not found')
      return a
    },
    async byOrder(orderId) {
      const [rows] = await pool.execute(`${selectAttempt} WHERE a.order_id=?`, [orderId])
      return rows[0] || null
    },
    async attachOrder(id, order) {
      return transaction(pool, async c => {
        const [rows] = await c.execute('SELECT * FROM reservation_attempts WHERE id=? FOR UPDATE', [id])
        const a = rows[0]
        if (!a || (a.order_id && a.order_id !== order.id) || (!a.order_id && !['creating','uncertain'].includes(a.order_state))) throw new HttpError(409, 'Order association requires review')
        await c.execute("UPDATE reservation_attempts SET order_id=?,order_state='ready' WHERE id=?", [order.id,id])
      })
    },
    async uncertain(id) {
      await pool.execute("UPDATE reservation_attempts SET order_state='uncertain' WHERE id=? AND order_id IS NULL", [id])
    },
    async checked(id) { await pool.execute('UPDATE reservation_attempts SET reconciled_at=NOW() WHERE id=?', [id]) },
    async due() {
      const [rows] = await pool.execute(`SELECT id FROM reservation_attempts
        WHERE (order_id IS NOT NULL OR order_state<>'none')
        ORDER BY COALESCE(reconciled_at,created_at) ASC LIMIT 50`)
      return rows
    },
    async record(a, p) {
      return transaction(pool, async c => {
        // The unique payment key makes retries safe even across webhook/callback.
        await c.execute(`INSERT INTO payment_records (payment_id,attempt_id,order_id,amount,currency,provider_status)
          VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE payment_id=VALUES(payment_id)`, [p.id,a.id,p.order_id,p.amount,p.currency,p.status])
        const [rows] = await c.execute('SELECT * FROM payment_records WHERE payment_id=? FOR UPDATE', [p.id])
        const old = rows[0]
        if (old.attempt_id !== a.id || old.order_id !== p.order_id || Number(old.amount) !== p.amount || old.currency !== p.currency) throw new HttpError(409, 'Payment association conflict')
        const rank = { created: 0, failed: 1, authorized: 2, captured: 3, refunded: 4 }
        if (rank[p.status] >= rank[old.provider_status]) await c.execute('UPDATE payment_records SET provider_status=?,checked_at=NOW() WHERE payment_id=?', [p.status,p.id])
        return old
      })
    },
    async resolve(paymentId, resolution, code = null) {
      // Review is terminal until an operator resolves the underlying payment.
      // A delayed pending/failed event cannot undo finalized/review state.
      await pool.execute(`UPDATE payment_records SET resolution=?,review_code=?,checked_at=NOW() WHERE payment_id=?
        AND (resolution IN ('pending','failed') OR ?='review')`, [resolution,code,paymentId,resolution])
    },
    async event(hash, eventId, eventType) {
      await pool.execute(`INSERT INTO payment_webhook_events (body_hash,event_id,event_type) VALUES (?,?,?)
        ON DUPLICATE KEY UPDATE body_hash=VALUES(body_hash)`, [hash,eventId,eventType])
      return (await pool.execute('SELECT state FROM payment_webhook_events WHERE body_hash=?', [hash]))[0][0].state
    },
    async eventDone(hash) { await pool.execute("UPDATE payment_webhook_events SET state='processed',processed_at=NOW() WHERE body_hash=?", [hash]) },
    async reviews() {
      return (await pool.execute("SELECT payment_id,attempt_id,review_code,checked_at FROM payment_records WHERE resolution='review' ORDER BY checked_at DESC LIMIT 100"))[0]
    }
  }
}
