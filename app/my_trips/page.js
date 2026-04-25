'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function MyTripsPage() {
  const [bookings, setBookings] = useState([])
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('history')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem('firstfly_user')
    if (!stored) { router.push('/login'); return }
    const u = JSON.parse(stored)
    setUser(u)

    fetch(`/api/bookings?userId=${u.id}`)
      .then(res => res.json())
      .then(data => { setBookings(data.bookings || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleCancel = async (b) => {
    if (!confirm('Cancel this booking?')) return
    const res = await fetch('/api/book/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnr: b.pnr, seat: b.seat, flightId: b.flight_id })
    })
    if (res.ok) setBookings(prev => prev.map(x => x.pnr === b.pnr ? { ...x, status: 'Cancelled' } : x))
  }

  const getCode = (city) => {
    const map = { Delhi: 'DEL', Mumbai: 'BOM', Bangalore: 'BLR', Chennai: 'MAA' }
    return map[city] || city?.trim().slice(0, 3).toUpperCase() || '???'
  }

  const getStatusStyle = (status) => {
    if (!status || status === 'Confirmed') return { bg: '#e8f5ee', color: '#2d7a4f', label: 'CONFIRMED' }
    if (status === 'Cancelled') return { bg: '#fde8e8', color: '#c0392b', label: 'CANCELLED' }
    if (status === 'Completed') return { bg: '#f0ebe0', color: '#888', label: 'COMPLETED' }
    return { bg: '#f0ebe0', color: '#888', label: (status || '').toUpperCase() }
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: '100vh', background: '#f5f2ec', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
        .trip-card { background:white; border-radius:20px; padding:28px 28px 24px; border:1px solid rgba(0,0,0,0.06); transition:all 0.2s; }
        .trip-card:hover { box-shadow:0 12px 40px rgba(0,0,0,0.1); transform:translateY(-3px); }
        .tab-btn { padding:10px 0; font-size:0.92rem; background:none; border:none; cursor:pointer; color:#aaa; font-family:'DM Sans',sans-serif; border-bottom:2px solid transparent; transition:all 0.2s; }
        .tab-btn.active { color:#1a1a1a; border-bottom:2px solid #1a1a1a; font-weight:500; }
        .view-btn { border-radius:100px; padding:10px 22px; border:1px solid rgba(0,0,0,0.14); background:white; font-family:'DM Sans',sans-serif; font-size:0.8rem; cursor:pointer; transition:all 0.15s; font-weight:500; color:#1a1a1a; }
        .view-btn:hover { background:#1a1a1a; color:white; border-color:#1a1a1a; }
        .cancel-btn { border-radius:100px; padding:10px 22px; border:1px solid rgba(192,57,43,0.25); background:transparent; color:#c0392b; font-family:'DM Sans',sans-serif; font-size:0.8rem; cursor:pointer; transition:all 0.15s; font-weight:500; }
        .cancel-btn:hover { background:#c0392b; color:white; border-color:#c0392b; }
        .filter-btn { display:flex; align-items:center; gap:6px; padding:9px 18px; border-radius:8px; border:1px solid rgba(0,0,0,0.12); background:white; font-size:0.78rem; cursor:pointer; font-family:'DM Sans',sans-serif; font-weight:500; color:#555; }
        .filter-btn:hover { background:#f5f2ec; }
      `}</style>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, maxWidth: '1100px', margin: '0 auto', width: '100%', padding: '52px 48px 80px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '3.4rem', fontWeight: 400, margin: '0 0 8px', letterSpacing: '-0.02em', color: '#1a1a1a', lineHeight: 1.1 }}>
              Trip History
            </h1>
            <p style={{ fontSize: '0.9rem', color: '#888', margin: 0, fontWeight: 300 }}>
              Review your past journeys and upcoming itineraries.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
            <button className="filter-btn">⊞ FILTER</button>
            <button className="filter-btn">⇅ SORT: DATE ▾</button>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '32px', marginBottom: '36px', borderBottom: '1px solid rgba(0,0,0,0.08)', marginTop: '28px' }}>
          {['upcoming', 'history'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* LOADING */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '100px 0', color: '#aaa' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.8rem', fontWeight: 300 }}>Loading your trips...</p>
          </div>
        )}

        {/* EMPTY */}
        {!loading && bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 300, color: '#aaa', marginBottom: '24px' }}>No trips yet</p>
            <Link href="/flights">
              <button style={{ background: '#1a1a1a', color: 'white', border: 'none', borderRadius: '100px', padding: '14px 32px', fontSize: '0.9rem', fontFamily: "'DM Sans',sans-serif", cursor: 'pointer' }}>
                Book your first flight →
              </button>
            </Link>
          </div>
        )}

        {/* TRIPS GRID */}
        {!loading && bookings.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
              {bookings.map(b => {
                const st = getStatusStyle(b.status)
                const fromCity = (b.origin || b.current_location || '---').trim()
                const toCity = (b.destination || b.desired_location || '---').trim()
                const dep = (b.departure_time || b.departure || '--:--').trim()
                const arr = (b.arrival_time || b.arrival || '--:--').trim()
                const fName = (b.flight_name || `Flight #${b.flight_id}`).trim()

                return (
                  <div key={b.pnr || b.id} className="trip-card">

                    {/* STATUS ROW */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                      <span style={{ background: st.bg, color: st.color, fontSize: '0.62rem', letterSpacing: '0.12em', fontWeight: 600, padding: '5px 11px', borderRadius: '6px', textTransform: 'uppercase' }}>
                        {st.label}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: '#bbb', fontWeight: 300 }}>PNR {b.pnr}</span>
                    </div>

                    {/* ROUTE */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', overflow: 'hidden' }}>
                      <div style={{ flex: '0 0 auto' }}>
                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.4rem', fontWeight: 700, margin: 0, letterSpacing: '-0.04em', color: '#1a1a1a', lineHeight: 1 }}>
                          {getCode(fromCity)}
                        </p>
                        <p style={{ fontSize: '0.72rem', color: '#999', margin: '4px 0 0', lineHeight: 1.3 }}>{fromCity}</p>
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '0 6px', minWidth: 0 }}>
                        <div style={{ width: '100%', position: 'relative' }}>
                          <div style={{ width: '100%', height: '1px', background: '#e0dbd4' }} />
                          <div style={{ position: 'absolute', top: '-9px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.85rem', color: '#ccc' }}>✈</div>
                        </div>
                        <p style={{ fontSize: '0.65rem', color: '#ccc', margin: 0, whiteSpace: 'nowrap' }}>
                          {dep} → {arr}
                        </p>
                      </div>

                      <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                        <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.4rem', fontWeight: 700, margin: 0, letterSpacing: '-0.04em', color: '#1a1a1a', lineHeight: 1 }}>
                          {getCode(toCity)}
                        </p>
                        <p style={{ fontSize: '0.72rem', color: '#999', margin: '4px 0 0', lineHeight: 1.3, textAlign: 'right' }}>{toCity}</p>
                      </div>
                    </div>

                    {/* DETAILS */}
                    <div style={{ display: 'flex', gap: '20px', paddingTop: '18px', borderTop: '1px solid #f5f2ec', marginBottom: '20px', flexWrap: 'wrap' }}>
                      {[
                        { label: 'FLIGHT', value: fName },
                        { label: 'CLASS', value: b.travel_class || 'Economy' },
                        { label: 'SEAT', value: b.seat || 'N/A' },
                        { label: 'PRICE', value: `₹${b.price}` },
                      ].map(d => (
                        <div key={d.label}>
                          <p style={{ fontSize: '0.57rem', letterSpacing: '0.14em', color: '#ccc', margin: '0 0 4px', textTransform: 'uppercase' }}>{d.label}</p>
                          <p style={{ fontSize: '0.88rem', fontWeight: 600, margin: 0, color: '#1a1a1a' }}>{d.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* ACTIONS */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="view-btn" onClick={() => {
                        const url = new URL('/confirmation', window.location.origin)
                        url.searchParams.set('pnr', b.pnr)
                        url.searchParams.set('name', b.name)
                        url.searchParams.set('flight', b.flight_id)
                        url.searchParams.set('seat', b.seat)
                        url.searchParams.set('class', b.travel_class)
                        url.searchParams.set('price', b.price)
                        url.searchParams.set('from', fromCity)
                        url.searchParams.set('to', toCity)
                        url.searchParams.set('departure', dep)
                        url.searchParams.set('arrival', arr)
                        url.searchParams.set('flightName', fName)
                        router.push(url.pathname + url.search)
                      }}>
                        View Receipt
                      </button>
                      {b.status !== 'Cancelled' && (
                        <button className="cancel-btn" onClick={() => handleCancel(b)}>
                          Cancel Trip
                        </button>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>

            {/* LOAD MORE */}
            <div style={{ textAlign: 'center', marginTop: '52px' }}>
              <button style={{ background: 'transparent', border: 'none', fontSize: '0.88rem', color: '#aaa', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Load Earlier Trips ▾
              </button>
            </div>
          </>
        )}

      </div>

      {/* FOOTER */}
      <div style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '44px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '6px' }}>
            FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.82rem', opacity: 0.45, margin: 0 }}>© 2026 FirstFly. Elevate your journey.</p>
        </div>
        <div style={{ display: 'flex', gap: '32px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.55 }}>
          {[['/flights', 'Flights'], ['/bookings', 'Bookings'], ['/checkin', 'Check-in'], ['/status', 'Status']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#f0ebe0', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </div>

    </div>
  )
}