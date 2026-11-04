import db from './db.js'
import { createAuth } from './auth.js'
import { createReservations } from './reservations.js'
import { createPayments } from './payments.js'
import { createPaymentStore } from './payment-store.js'
import { createPaymentFlow } from './payment-flow.js'
import { createBookingHandlers } from './booking-handlers.js'

export const auth = createAuth(db)
const reservations = createReservations(db)
export const paymentFlow = createPaymentFlow({ reservations, store: createPaymentStore(db), gateway: createPayments() })
export const handlers = createBookingHandlers({ auth, reservations, paymentFlow })
