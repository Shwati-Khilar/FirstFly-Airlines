import db from '../lib/db.js'
import { createPaymentStore } from '../lib/payment-store.js'
import { createReservations } from '../lib/reservations.js'
import { createPayments } from '../lib/payments.js'
import { createPaymentFlow } from '../lib/payment-flow.js'
import { attemptId } from '../lib/http.js'

const store = createPaymentStore(db)
const gateway = createPayments()
const flow = createPaymentFlow({ store, gateway, reservations: createReservations(db) })
try {
  if (process.argv[2] === '--reviews') {
    console.table(await store.reviews())
  } else {
    gateway.config()
    const attempts = process.argv[2] ? [{ id: attemptId(process.argv[2]) }] : await store.due()
    for (const { id } of attempts) {
      try {
        const result = await flow.reconcileAttempt(id)
        console.log(id, result.state)
      } catch {
        // Do not print provider exceptions, request credentials or passenger data.
        console.error(id, 'Reconciliation failed; retry required')
        process.exitCode = 1
      } finally {
        // Keep a failing attempt from starving the rest of the batch on each run.
        await store.checked(id)
      }
    }
  }
} catch {
  console.error('Reconciliation unavailable. Check database and payment configuration.')
  process.exitCode = 1
} finally { await db.end() }
