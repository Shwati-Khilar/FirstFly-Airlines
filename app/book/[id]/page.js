'use client'
import { useState, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import toast from "react-hot-toast"

function BookPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedSeat, setSelectedSeat] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)

  const id = params?.id
  const from = (searchParams.get('from') || '').trim()
  const to = (searchParams.get('to') || '').trim()
  const departure = (searchParams.get('departure') || '').trim()
  const arrival = (searchParams.get('arrival') || '').trim()
  const flightName = (searchParams.get('flightName') || '').trim()

  const [form, setForm] = useState({ name: '', age: '', gender: '', travelClass: 'Economy' })
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const basePrice = 5000
  const finalPrice = form.travelClass === 'Business' ? basePrice * 1.5 : basePrice

  const businessRows = [1, 2, 3]
  const economyRows = Array.from({ length: 12 }, (_, i) => i + 4)
  const occupied = new Set(['1B', '2D', '3A', '3F', '4C', '4D', '5A', '5B', '6E', '7F', '8C', '9A', '10D', '11B', '12F', '13C', '14E', '15A'])

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
    if (occupied.has(seatId)) return
    setSelectedSeat(seatId === selectedSeat ? '' : seatId)
  }

  // ── RAZORPAY PAYMENT FLOW ──
  const handlePayment = async () => {
    if (!form.name || !form.age || !form.gender) { toast.error('Please fill in all passenger details'); return }
    if (!selectedSeat) { toast.error('Please select a seat'); return }

    setPaymentLoading(true);

    const user = JSON.parse(localStorage.getItem('firstfly_user'))
    if (!user) {
      toast.error("Please login to continue.");

      router.push("/login");
      return;
    }

    try {
      // ── STEP 1: Lock the seat before payment ──
      const lockRes = await fetch('/api/seats/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatId: selectedSeat, userId: user.id, flightId: id })
      })
      const lockData = await lockRes.json()

      if (lockData.error) {
        toast.error("This seat is no longer available.");

        setPaymentLoading(false)
        return
      }

      // ── STEP 2: Create Razorpay order ──
      const orderRes = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalPrice })
      })
      const order = await orderRes.json()
      if (order.error) { toast.error('Payment initiation failed: ' + order.error); setPaymentLoading(false); return }

      // ── STEP 3: Open Razorpay ──
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://checkout.razorpay.com/v1/checkout.js'
          script.onload = resolve
          script.onerror = reject
          document.body.appendChild(script)
        })
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'FirstFly Airways',
        description: `Flight ${id} — Seat ${selectedSeat}`,
        order_id: order.id,
        prefill: { name: form.name },
        theme: { color: '#1a1a1a' },
        handler: async (response) => {
          // ── STEP 4: Save booking ──
          const bookRes = await fetch('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name,
              age: form.age,
              gender: form.gender,
              travelClass: form.travelClass,
              flight_id: id,
              price: finalPrice,
              seat: selectedSeat,
              payment_id: response.razorpay_payment_id,
              user_id: user.id
            })
          })
          const data = await bookRes.json()
          if (!bookRes.ok) {

            await fetch("/api/seats/release", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                seatId: selectedSeat,
                userId: user.id
              })
            });

            toast.error(data.error || "Booking failed");

            setPaymentLoading(false);
            return;
          }

          const url = new URL('/confirmation', window.location.origin)
          url.searchParams.set('pnr', data.pnr)
          url.searchParams.set('name', form.name)
          url.searchParams.set('flight', id)
          url.searchParams.set('seat', selectedSeat)
          url.searchParams.set('class', form.travelClass)
          url.searchParams.set('price', finalPrice)
          url.searchParams.set('from', from)
          url.searchParams.set('to', to)
          url.searchParams.set('departure', departure)
          url.searchParams.set('arrival', arrival)
          url.searchParams.set('flightName', flightName)
          toast.success(
    `Seat ${selectedSeat} booked successfully!`
);

          setTimeout(() => {
            router.push(url.pathname + url.search);
          }, 1200);
        },
        modal: {
          ondismiss: async () => {
            // ── Release lock if user closes payment ──
            await fetch('/api/seats/release', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ seatId: selectedSeat, userId: user.id })
            })
            setPaymentLoading(false)
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (err) {
      console.error(err)
      toast.error("Unable to lock the selected seat.")
      setPaymentLoading(false)
    }
  }

  const SeatBtn = ({ row, col }) => {
    const seatId = `${col}${row}`
    const colors = getSeatColor(seatId, row)
    return (
      <button
        type="button"
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

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '60px 40px' }}>

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
              { value: 'Business', label: 'Business Class', sub: 'Elevated Serenity', price: '₹7,500', perks: ['Flat-bed recliners', 'Priority boarding'] },
              { value: 'Economy', label: 'Economy', sub: 'Smart Efficiency', price: '₹5,000', perks: ['Standard comfort', '1 Checked Bag'] },
            ].map(cls => (
              <div key={cls.value} onClick={() => setForm(f => ({ ...f, travelClass: cls.value }))}
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
                      {getSeatType(selectedSeat.slice(-1))}
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
              disabled={paymentLoading}
              className="pay-btn"
              style={{ width: '100%', background: '#1a1a1a', color: '#f0ebe0', padding: '18px 32px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.1em', transition: 'all 0.2s', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              {paymentLoading ? (
                <>
                  <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Processing...
                </>
              ) : (
                <>Pay ₹{finalPrice.toLocaleString()} via Razorpay ✦</>
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
                  {getSeatType(selectedSeat.slice(-1))} · {parseInt(selectedSeat) <= 3 ? 'Business' : 'Economy'}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedSeat('')}
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