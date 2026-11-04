'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { seatClass } from '@/lib/frontend-model'
import toast from "react-hot-toast"

function BookPageInner() {
  const params = useParams()
  const router = useRouter()
  const [flightData, setFlightData] = useState(null)
  const [selectedSeat, setSelectedSeat] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)

  const id = params?.id
  const from = flightData?.current_location?.trim() || ''
  const to = flightData?.desired_location?.trim() || ''
  const departure = flightData?.departure_time || ''
  const flightName = flightData?.flight_name || ''

  const [form, setForm] = useState({ name: '', age: '', gender: '', travelClass: 'Economy' })
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const [fares, setFares] = useState(null)
  const basePrice = fares?.Economy || 0
  const [seats, setSeats] = useState([])
  const [flightError, setFlightError] = useState('')
  const [availabilityError, setAvailabilityError] = useState('')
  const [pending, setPending] = useState(null)
  const busy = useRef(false)
  const pendingKey = 'firstfly_pending_' + id
  const loadSeats = useCallback(async () => {
    const res = await fetch('/api/seats/get?flight=' + encodeURIComponent(id), { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Unable to load seats')
    setSeats(data)
    setAvailabilityError('')
  }, [id])
  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      try { const saved = sessionStorage.getItem(pendingKey); if (saved && active) setPending(JSON.parse(saved)) } catch { /* Ignore corrupt recovery data. */ }
    })
    fetch('/api/flights?id=' + encodeURIComponent(id)).then(async r => {
      const data = await r.json()
      if (!r.ok || !data[0]?.fares) throw new Error('Flight or fare unavailable')
      if (active) { setFlightData(data[0]); setFares(data[0].fares) }
    }).catch(err => { if (active) setFlightError(err.message) })
    const refresh = () => loadSeats().catch(err => { if (active) setAvailabilityError(err.message) })
    refresh()
    const timer = setInterval(refresh, 15000)
    return () => { active = false; clearInterval(timer) }
  }, [id, loadSeats, pendingKey])
  const finalPrice = fares?.[pending?.travelClass || form.travelClass] || 0

  const businessRows = [1, 2, 3]
  const economyRows = Array.from({ length: 12 }, (_, i) => i + 4)
  const occupied = new Set(seats.filter(s => s.status !== 'available').map(s => s.seat_number))

  const getSeatType = (col) => {
    if (col === 'A' || col === 'F') return 'window'
    if (col === 'C' || col === 'D') return 'aisle'
    return 'middle'
  }

  const getSeatColor = (seatId, row) => {
    if (occupied.has(seatId)) return { bg: '#d0cfc8', border: '#b8b7b0', color: '#999', cursor: 'not-allowed' }
    if (selectedSeat === seatId) return { bg: '#1a1a1a', border: '#1a1a1a', color: 'white', cursor: 'pointer' }
    if (row <= 3) return { bg: '#e8e0d0', border: '#c8bfb0', color: '#5a4a3a', cursor: 'pointer' }
    return { bg: '#f0ebe0', border: '#d8d0c4', color: '#555', cursor: 'pointer' }
  }

  const handleSeatClick = (seatId) => {
    if (paymentLoading || pending || occupied.has(seatId) || !seats.some(s => s.seat_number === seatId)) return
    setForm(f => ({ ...f, travelClass: seatClass(seatId) }))
    setSelectedSeat(seatId === selectedSeat ? '' : seatId)
  }

  function remember(payload) {
    setPending(payload)
    try { sessionStorage.setItem(pendingKey, JSON.stringify(payload)) } catch { /* In-memory recovery remains available. */ }
  }
  function clearPending() {
    setPending(null)
    try { sessionStorage.removeItem(pendingKey) } catch { /* Ignore unavailable storage. */ }
  }
  async function post(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok && !data.state) {
      if (res.status === 401) router.push('/login')
      throw new Error(data.error || 'Request failed')
    }
    return data
  }
  function showOutcome(data) {
    if (data.state !== 'confirmed' || !data.success || !data.pnr) {
      toast.error(data.message || 'Payment needs review. Do not pay again.', { duration: 7000 })
      return
    }
    clearPending()
    const url = new URL('/confirmation', window.location.origin)
    url.searchParams.set('pnr', data.pnr)
    toast.success('Booking confirmed')
    router.push(url.pathname + url.search)
  }
  async function finishBooking(payload) {
    try {
      const endpoint = payload.razorpay_signature ? '/api/book' : '/api/payment/reconcile'
      showOutcome(await post(endpoint, payload), payload)
    } catch (err) {
      toast.error(err.message + '. Check payment status again; do not start another payment.', { duration: 8000 })
    } finally { busy.current = false; setPaymentLoading(false) }
  }
  async function openCheckout(payload) {
    // Persist BEFORE requesting an order: a lost response must not start a new attempt.
    remember(payload)
    const order = await post('/api/payment', payload)
    if (!order.id) { showOutcome(order, payload); return false }
    if (!window.Razorpay) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = resolve
        script.onerror = () => reject(new Error('Unable to load checkout; resume this attempt'))
        document.body.appendChild(script)
      })
    }
    const rzp = new window.Razorpay({
      key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.id,
      name: 'FirstFly Airways', description: 'Flight ' + payload.flightId + ' — Seat ' + payload.seatNumber,
      prefill: { name: payload.name }, theme: { color: '#1a1a1a' },
      handler: async response => {
        const proof = { ...payload, ...response }
        remember(proof)
        await finishBooking(proof)
      },
      modal: { ondismiss: () => {
        busy.current = false; setPaymentLoading(false)
        toast('Checkout closed. Check payment status or cancel the reservation.')
      } }
    })
    rzp.on('payment.failed', () => toast.error('Payment failed. Retry this checkout or close it and check payment status.'))
    rzp.open()
    return true
  }
  const handlePayment = async () => {
    if (busy.current) return
    if (pending) {
      busy.current = true; setPaymentLoading(true)
      await finishBooking(pending)
      return
    }
    if (!form.name.trim() || !Number.isInteger(Number(form.age)) || Number(form.age) < 1 || Number(form.age) > 120 || !form.gender) {
      toast.error('Please enter valid passenger details'); return
    }
    if (!selectedSeat || !basePrice || availabilityError || occupied.has(selectedSeat)) { toast.error('Select an available seat'); return }
    busy.current = true; setPaymentLoading(true)
    const payload = { ...form, flightId: id, seatNumber: selectedSeat, attemptId: crypto.randomUUID() }
    let checkout = false
    try {
      await post('/api/seats/lock', payload)
      checkout = await openCheckout(payload)
    } catch (err) { toast.error(err.message) }
    finally { if (!checkout) { busy.current = false; setPaymentLoading(false) } }
  }
  async function resumeCheckout() {
    if (busy.current || !pending || pending.razorpay_signature) return
    busy.current = true; setPaymentLoading(true)
    let checkout = false
    try { checkout = await openCheckout(pending) }
    catch (err) { toast.error(err.message) }
    finally { if (!checkout) { busy.current = false; setPaymentLoading(false) } }
  }
  async function cancelPending() {
    if (busy.current || !pending) return
    if (!confirm('Release this reservation? Any payment that completes afterwards requires support/refund review.')) return
    busy.current = true; setPaymentLoading(true)
    try {
      const outcome = await post('/api/payment/reconcile', pending)
      if (outcome.state === 'confirmed') { showOutcome(outcome, pending); return }
      if (outcome.state === 'review' || pending.razorpay_signature) { showOutcome(outcome, pending); return }
      await post('/api/seats/release', pending)
      clearPending()
      await loadSeats()
      toast('Reservation released. No refund has been processed.')
    } catch (err) { toast.error(err.message + '. Reservation retained for recovery.') }
    finally { busy.current = false; setPaymentLoading(false) }
  }

  const SeatBtn = ({ row, col }) => {
    const seatId = `${col}${row}`
    const colors = getSeatColor(seatId, row)
    return (
      <button
        aria-pressed={selectedSeat === seatId}
        aria-label={`${seatId}, ${row <= 3 ? 'Business' : 'Economy'}, ${occupied.has(seatId) ? 'unavailable' : 'available'}`}
        type="button"
        disabled={paymentLoading || !!pending || occupied.has(seatId) || !seats.some(s => s.seat_number === seatId)}
        onClick={() => handleSeatClick(seatId)}
        title={`${seatId} — ${getSeatType(col)}`}
        style={{
          width: '36px', height: '40px',
          borderRadius: '8px 8px 4px 4px',
          border: `1.5px solid ${colors.border}`,
          background: colors.bg,
          color: colors.color,
          fontSize: '0.65rem',
          fontFamily: "'DM Sans', sans-serif",
          cursor: colors.cursor,
          transition: 'all 0.15s',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '1px',
          boxShadow: selectedSeat === seatId ? '0 4px 12px rgba(0,0,0,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ width: '70%', height: '3px', background: colors.border, borderRadius: '2px', opacity: 0.5 }} />
        <span style={{ fontSize: '0.6rem', fontWeight: 600 }}>{seatId}</span>
      </button>
    )
  }

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", background: '#f0ebe0', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .form-input:focus { outline: none; border-bottom: 2px solid #1a1a1a !important; }
        .pay-btn:hover:not(:disabled) { background: #333 !important; transform: translateY(-1px); }
        .pay-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="booking-layout" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '60px 40px' }}>

        {/* ── LEFT ── */}
        <div style={{ paddingRight: '48px', borderRight: '1px solid rgba(0,0,0,0.08)' }}>

          <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '8px', textTransform: 'uppercase' }}>Booking</p>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 300, letterSpacing: '-0.02em', color: '#1a1a1a', marginBottom: '32px', lineHeight: 1.1 }}>
            Confirm Your <em style={{ fontStyle: 'italic', fontWeight: 600 }}>Flight</em>
          </h1>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#888', fontSize: '0.9rem', marginBottom: '36px', lineHeight: 1.6 }}>
            Personalize your journey at 30,000 feet with FirstFly Airways.
          </p>

          {/* CLASS CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
            {[
              { value: 'Business', label: 'Business Class', sub: 'Elevated Serenity', price: '₹' + (fares?.Business || 0).toLocaleString(), perks: ['Flat-bed recliners', 'Priority boarding'] },
              { value: 'Economy', label: 'Economy', sub: 'Smart Efficiency', price: '₹' + basePrice.toLocaleString(), perks: ['Standard comfort', '1 Checked Bag'] },
            ].map(cls => (
              <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click() } }} aria-pressed={form.travelClass === cls.value} key={cls.value} onClick={() => { if (!paymentLoading && !pending) { setForm(f => ({ ...f, travelClass: cls.value })); setSelectedSeat('') } }}
                style={{
                  padding: '20px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s',
                  border: form.travelClass === cls.value ? '2px solid #1a1a1a' : '2px solid transparent',
                  background: form.travelClass === cls.value ? 'white' : 'rgba(255,255,255,0.5)',
                  boxShadow: form.travelClass === cls.value ? '0 8px 24px rgba(0,0,0,0.1)' : 'none'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: '0 0 2px' }}>{cls.label}</p>
                    <p style={{ fontSize: '0.75rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{cls.sub}</p>
                  </div>
                  {cls.value === 'Business' && <span>★</span>}
                </div>
                <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: '10px 0 8px' }}>{cls.price} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888', fontFamily: "'DM Sans', sans-serif" }}>/ seat</span></p>
                {cls.perks.map(p => (
                  <p key={p} style={{ fontSize: '0.78rem', color: '#666', fontFamily: "'DM Sans', sans-serif", margin: '2px 0', display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#1a1a1a' }}>✓</span> {p}
                  </p>
                ))}
              </div>
            ))}
          </div>

          {/* PASSENGER FORM */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 500, marginBottom: '24px' }}>Passenger Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#888', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Full Name</label>
                <input type="text" name="name" placeholder="Your name" onChange={handleChange} required className="form-input"
                  style={{ width: '100%', border: 'none', borderBottom: '1px solid #ddd', background: 'transparent', fontSize: '1rem', padding: '6px 0', color: '#1a1a1a', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#888', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Age</label>
                <input type="number" name="age" placeholder="Age" onChange={handleChange} required className="form-input"
                  style={{ width: '100%', border: 'none', borderBottom: '1px solid #ddd', background: 'transparent', fontSize: '1rem', padding: '6px 0', color: '#1a1a1a', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: '#888', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Gender</label>
                <select name="gender" onChange={handleChange} required className="form-input"
                  style={{ width: '100%', border: 'none', borderBottom: '1px solid #ddd', background: 'transparent', fontSize: '1rem', padding: '6px 0', color: '#1a1a1a', fontFamily: "'DM Sans', sans-serif" }}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>
            <div style={{ background: '#f8f6f2', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ opacity: 0.6 }}>ℹ</span>
              <p style={{ fontSize: '0.78rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Ensure your name matches your passport for seamless boarding.</p>
            </div>
          </div>

          {/* FLIGHT SUMMARY */}
          <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '0 0 4px', textTransform: 'uppercase' }}>Flight {id}</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 600, color: 'white', margin: 0 }}>
                {from.slice(0, 3).toUpperCase() || 'DEP'} → {to.slice(0, 3).toUpperCase() || 'ARR'}
              </p>
              <p style={{ fontSize: '0.8rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '2px 0 0' }}>{flightName}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '0 0 4px', textTransform: 'uppercase' }}>Departure</p>
              <p style={{ fontSize: '1.3rem', fontWeight: 600, color: 'white', margin: 0 }}>{departure || '--:--'}</p>
            </div>
          </div>

          {/* PRICE + PAY BUTTON */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '0.7rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '0 0 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {selectedSeat ? `Seat ${selectedSeat} Total` : 'Total Price'}
                </p>
                <p style={{ fontSize: '2.4rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>₹{finalPrice.toLocaleString()}</p>
                <p style={{ fontSize: '0.72rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif", margin: '4px 0 0' }}>Taxes and carrier fees included.</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {selectedSeat && (
                  <div style={{ background: '#f0ebe0', borderRadius: '8px', padding: '8px 14px' }}>
                    <p style={{ fontSize: '0.62rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif", margin: '0 0 2px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Seat</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{selectedSeat}</p>
                    <p style={{ fontSize: '0.7rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '1px 0 0' }}>
                      {getSeatType(selectedSeat[0])}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment methods hint */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {['UPI', 'Cards', 'Net Banking', 'Wallets'].map(m => (
                <span key={m} style={{ background: '#f0ebe0', borderRadius: '6px', padding: '4px 10px', fontSize: '0.7rem', fontFamily: "'DM Sans', sans-serif", color: '#666', letterSpacing: '0.05em' }}>{m}</span>
              ))}
            </div>

            <button
              onClick={handlePayment}
              disabled={paymentLoading || (!pending && (!basePrice || !seats.length || !!availabilityError))}
              className="pay-btn"
              style={{ width: '100%', background: '#1a1a1a', color: '#f0ebe0', padding: '18px 32px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.1em', transition: 'all 0.2s', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              {paymentLoading ? (
                <>
                  <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Processing...
                </>
              ) : (
                <>{pending ? 'Check payment / retry confirmation' : 'Pay ₹' + finalPrice.toLocaleString() + ' via Razorpay ✦'}</>
              )}
            </button>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif", marginTop: '12px' }}>
              🔒 Secured by Razorpay · PCI DSS Compliant
            </p>
          </div>

        </div>

        {/* ── RIGHT — SEAT MAP ── */}
        <div style={{ paddingLeft: '48px' }}>

          <p style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '8px', textTransform: 'uppercase' }}>Cabin</p>
          <h2 style={{ fontSize: '2.8rem', fontWeight: 300, letterSpacing: '-0.02em', color: '#1a1a1a', marginBottom: '8px', lineHeight: 1.1 }}>
            Select <em style={{ fontStyle: 'italic', fontWeight: 600 }}>Seat</em>
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#888', fontSize: '0.85rem', marginBottom: '24px' }}>Choose your horizon</p>

          {flightError && <p role="alert">{flightError}</p>}
          {!fares && !flightError && <p role="status">Loading flight and fares…</p>}
          {availabilityError && <p role="alert">{availabilityError}</p>}
          {pending && <div role="status">
            <p>Reservation {pending.attemptId}. Check payment status before starting another booking.</p>
            {!pending.razorpay_signature && <button type="button" disabled={paymentLoading} onClick={resumeCheckout}>Resume same checkout</button>}
            <button type="button" disabled={paymentLoading} onClick={cancelPending}>Cancel reservation</button>
          </div>}
          {/* LEGEND */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: '#666' }}>
            {[
              { color: '#f0ebe0', border: '#d8d0c4', label: 'Available' },
              { color: '#1a1a1a', border: '#1a1a1a', label: 'Selected' },
              { color: '#d0cfc8', border: '#b8b7b0', label: 'Occupied' },
              { color: '#e8e0d0', border: '#c8bfb0', label: 'Business' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '18px', borderRadius: '4px 4px 2px 2px', background: l.color, border: `1.5px solid ${l.border}` }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>

          {/* AIRCRAFT */}
          <div style={{ background: 'white', borderRadius: '24px', padding: '24px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', maxWidth: '340px' }}>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '120px', height: '40px', background: '#f0ebe0', borderRadius: '60px 60px 0 0', border: '1px solid #e0d9ce', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.15em', color: '#aaa', fontFamily: "'DM Sans', sans-serif", margin: 0, textTransform: 'uppercase' }}>Cockpit</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '24px 36px 36px 36px 16px 36px 36px 36px', gap: '4px', marginBottom: '8px', alignItems: 'center' }}>
              <div />
              {['A', 'B', 'C', '', 'D', 'E', 'F'].map((c, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 600, color: '#aaa', fontFamily: "'DM Sans', sans-serif" }}>
                  {c === '' ? <div style={{ color: '#ddd' }}>│</div> : (
                    <div>{c}<div style={{ fontSize: '0.5rem', color: '#ccc', marginTop: '1px' }}>{c === 'A' || c === 'F' ? '🪟' : c === 'C' || c === 'D' ? '🚶' : '·'}</div></div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ flex: 1, height: '1px', background: '#e8e0d0' }} />
                <span style={{ fontSize: '0.58rem', letterSpacing: '0.15em', color: '#b8a898', fontFamily: "'DM Sans', sans-serif", padding: '0 8px', textTransform: 'uppercase' }}>Business</span>
                <div style={{ flex: 1, height: '1px', background: '#e8e0d0' }} />
              </div>
              {businessRows.map(row => (
                <div key={row} style={{ display: 'grid', gridTemplateColumns: '24px 36px 36px 36px 16px 36px 36px 36px', gap: '4px', marginBottom: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif", textAlign: 'right', paddingRight: '4px' }}>{row}</span>
                  {['A', 'B', 'C'].map(col => <SeatBtn key={col} row={row} col={col} />)}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '1px', height: '28px', background: '#e8e0d0' }} /></div>
                  {['D', 'E', 'F'].map(col => <SeatBtn key={col} row={row} col={col} />)}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0 10px' }}>
              <div style={{ flex: 1, height: '1px', background: '#e0d9ce' }} />
              <span style={{ fontSize: '0.58rem', letterSpacing: '0.15em', color: '#b0a898', fontFamily: "'DM Sans', sans-serif", padding: '0 8px', textTransform: 'uppercase' }}>Economy</span>
              <div style={{ flex: 1, height: '1px', background: '#e0d9ce' }} />
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
              {economyRows.map(row => (
                <div key={row} style={{ display: 'grid', gridTemplateColumns: '24px 36px 36px 36px 16px 36px 36px 36px', gap: '4px', marginBottom: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif", textAlign: 'right', paddingRight: '4px' }}>{row}</span>
                  {['A', 'B', 'C'].map(col => <SeatBtn key={col} row={row} col={col} />)}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '1px', height: '28px', background: '#e8e0d0' }} /></div>
                  {['D', 'E', 'F'].map(col => <SeatBtn key={col} row={row} col={col} />)}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
              <div style={{ width: '80px', height: '24px', background: '#f0ebe0', borderRadius: '0 0 40px 40px', border: '1px solid #e0d9ce' }} />
            </div>
          </div>

          {selectedSeat && (
            <div style={{ marginTop: '16px', background: '#1a1a1a', borderRadius: '14px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '340px' }}>
              <div>
                <p style={{ fontSize: '0.65rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '0 0 2px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Selected</p>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'white', margin: 0 }}>Seat {selectedSeat}</p>
                <p style={{ fontSize: '0.75rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '2px 0 0' }}>
                  {getSeatType(selectedSeat[0])} · {Number(selectedSeat.slice(1)) <= 3 ? 'Business' : 'Economy'}
                </p>
              </div>
              <button type="button" onClick={() => { if (!paymentLoading && !pending) setSelectedSeat('') }}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '48px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
            FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.5, margin: 0 }}>© 2026 FirstFly. Elevate your journey.</p>
        </div>
        <div style={{ display: 'flex', gap: '32px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.6 }}>
          {[['/', 'Home'], ['/flights', 'Flights'], ['/my_trips', 'My Trips'], ['/checkin', 'Check-in']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: '#f0ebe0', textDecoration: 'none' }}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Georgia, serif', fontSize: '1.2rem', color: '#888' }}>Loading...</div>}>
      <BookPageInner />
    </Suspense>
  )
}
