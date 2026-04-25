'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CheckInPage() {
  const [pnr, setPnr] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCheckIn = async () => {
    if (!pnr || !name) { setError('Please fill in all fields'); return }
    setLoading(true)
    setError('')

    const res = await fetch(`/api/checkin?pnr=${pnr}&name=${encodeURIComponent(name)}`)
    const result = await res.json()
    setLoading(false)

    if (result.error) { setError(result.error); return }

    const url = new URL('/confirmation', window.location.origin)
    url.searchParams.set('pnr', result.pnr)
    url.searchParams.set('name', result.name)
    url.searchParams.set('flight', result.flight_id)
    url.searchParams.set('seat', result.seat)
    url.searchParams.set('class', result.travel_class)
    url.searchParams.set('price', result.price)
    url.searchParams.set('from', (result.current_location || '').trim())
    url.searchParams.set('to', (result.desired_location || '').trim())
    url.searchParams.set('departure', (result.departure_time || '').trim())
    url.searchParams.set('arrival', (result.arrival_time || '').trim())
    url.searchParams.set('flightName', (result.flight_name || '').trim())

    router.push(url.pathname + url.search)
  }

  return (
    <div style={{
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        .checkin-input {
          width: 100%;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 12px;
          padding: 18px 20px;
          font-size: 1rem;
          font-family: 'DM Sans', sans-serif;
          color: #1a1a1a;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .checkin-input:focus {
          outline: none;
          background: white;
          border-color: rgba(0,0,0,0.25);
          box-shadow: 0 0 0 3px rgba(0,0,0,0.05);
        }
        .checkin-input::placeholder { color: #aaa; }

        .begin-btn {
          width: 100%;
          background: #1a1a1a;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 18px;
          font-size: 0.8rem;
          letter-spacing: 0.18em;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .begin-btn:hover:not(:disabled) { background: #333; transform: translateY(-1px); }
        .begin-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .feature-icon { transition: all 0.3s; }
        .feature-icon:hover { transform: translateY(-4px); opacity: 1 !important; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.8s cubic-bezier(.22,1,.36,1) both; }
        .fade-up-2 { animation: fadeUp 0.8s 0.15s cubic-bezier(.22,1,.36,1) both; }
        .fade-up-3 { animation: fadeUp 0.8s 0.3s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* BACKGROUND — gradient sky */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'linear-gradient(160deg, #e8e0d0 0%, #d4cfc8 30%, #c8c4be 55%, #b8bfc8 80%, #a8b5c4 100%)',
      }} />

      {/* Soft cloud-like blobs */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '-10%', width: '600px', height: '300px', background: 'radial-gradient(ellipse, rgba(255,255,255,0.5) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '40%', right: '-5%', width: '500px', height: '250px', background: 'radial-gradient(ellipse, rgba(255,255,255,0.4) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '20%', left: '20%', width: '700px', height: '200px', background: 'radial-gradient(ellipse, rgba(255,255,255,0.35) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      {/* CONTENT */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* HERO TEXT */}
        <div className="fade-up" style={{ textAlign: 'center', padding: '80px 24px 48px' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '16px', textTransform: 'uppercase' }}>
            Seamless Departure
          </p>
          <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', fontWeight: 400, letterSpacing: '-0.02em', color: '#1a1a1a', margin: 0, lineHeight: 1.1 }}>
            Your Journey <em style={{ fontStyle: 'italic' }}>Awaits</em>
          </h1>
        </div>

        {/* FORM CARD */}
        <div className="fade-up-2" style={{ display: 'flex', justifyContent: 'center', padding: '0 24px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '24px',
            padding: '40px',
            width: '100%',
            maxWidth: '500px',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.08)'
          }}>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: '#888', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase' }}>
                  Booking Reference (PNR)
                </label>
                <span style={{ fontSize: '0.75rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', textDecoration: 'underline' }}>
                  Where do I find my PNR?
                </span>
              </div>
              <input
                className="checkin-input"
                placeholder="E.g. 362376"
                value={pnr}
                onChange={e => setPnr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCheckIn()}
              />
            </div>

            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.18em', color: '#888', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', marginBottom: '8px' }}>
                Last Name
              </label>
              <input
                className="checkin-input"
                placeholder="Enter as shown on passport"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCheckIn()}
              />
            </div>

            <button className="begin-btn" onClick={handleCheckIn} disabled={loading}>
              {loading ? 'Checking...' : 'Begin Check-In'}
            </button>

            {error && (
              <p style={{ marginTop: '16px', textAlign: 'center', color: '#c0392b', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem' }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: '24px', marginTop: '28px', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem', opacity: 0.5 }}>?</span>
                <span style={{ fontSize: '0.8rem', color: '#888', fontFamily: "'DM Sans', sans-serif" }}>Need assistance?</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem', opacity: 0.5 }}>🕐</span>
                <span style={{ fontSize: '0.8rem', color: '#888', fontFamily: "'DM Sans', sans-serif" }}>Available 24h before departure</span>
              </div>
            </div>

          </div>
        </div>

        {/* BOTTOM FEATURES */}
        <div className="fade-up-3" style={{ display: 'flex', justifyContent: 'center', gap: '80px', padding: '60px 24px 40px', textAlign: 'center' }}>
          {[
            { icon: '🧳', label: 'Priority Baggage' },
            { icon: '💺', label: 'Select Suite' },
            { icon: '🪪', label: 'Digital Pass' },
          ].map(f => (
            <div key={f.label} className="feature-icon" style={{ opacity: 0.5, cursor: 'default' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>{f.icon}</div>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', color: '#666', margin: 0 }}>
                {f.label}
              </p>
            </div>
          ))}
        </div>

      </div>

      {/* FOOTER */}
      <div style={{position: 'relative',zIndex: 10,background: '#1a1a1a',color: '#f0ebe0',padding: '48px 60px',display: 'flex',justifyContent: 'space-between',alignItems: 'center'
      }}>              <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
            FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.5, margin: 0 }}>© 2026 FirstFly. Elevate your journey.</p>
        </div>
        <div style={{ display: 'flex', gap: '32px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.6 }}>
          {[['/flights', 'Flights'], ['/bookings', 'Bookings'], ['/checkin', 'Check-in'], ['/status', 'Status']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#f0ebe0', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </div>
    </div>
  )
}