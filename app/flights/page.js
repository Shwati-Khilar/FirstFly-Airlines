import Link from 'next/link'

async function getFlights() {
  const res = await fetch('/api/flights', { cache: 'no-store' })
  return res.json()
}

export default async function FlightsPage(props) {
  const searchParams = await props.searchParams
  const flights = await getFlights()

  const from = searchParams?.from?.toLowerCase().trim() || ''
  const to = searchParams?.to?.toLowerCase().trim() || ''

  const filteredFlights = from && to
    ? flights.filter(f =>
        f.current_location.toLowerCase().trim() === from &&
        f.desired_location.toLowerCase().trim() === to
      )
    : flights

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif", background: '#f0ebe0', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .flight-card { transition: all 0.3s ease; border: 1px solid rgba(0,0,0,0.08); }
        .flight-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.12) !important; }
        .book-btn:hover { background: #333 !important; }
      `}</style>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: '60px' }}>
        <div style={{ marginBottom: '48px' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '8px', textTransform: 'uppercase' }}>
            {from && to ? `${from} → ${to}` : 'All routes'}
          </p>
          <h1 style={{ fontSize: '3rem', fontWeight: 300, letterSpacing: '-0.02em', color: '#1a1a1a', margin: 0 }}>
            Available <em style={{ fontStyle: 'italic', fontWeight: 600 }}>Flights</em>
          </h1>
        </div>

        {filteredFlights.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 300, color: '#888' }}>No flights found for this route 😔</p>
            <Link href="/">
              <button style={{ marginTop: '24px', background: '#1a1a1a', color: '#f0ebe0', padding: '12px 32px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}>
                ← Back to Search
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
            {filteredFlights.map((flight) => (
              <div key={flight.flight_code} className="flight-card" style={{ background: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div>
                    <p style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '4px', textTransform: 'uppercase' }}>Flight</p>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 500, color: '#1a1a1a', margin: 0 }}>{flight.flight_name}</h2>
                  </div>
                  <span style={{ background: '#f0ebe0', padding: '4px 12px', borderRadius: '100px', fontSize: '0.75rem', fontFamily: "'DM Sans', sans-serif", color: '#666', letterSpacing: '0.05em' }}>
                    #{flight.flight_code}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
                      {flight.current_location?.trim().slice(0, 3).toUpperCase()}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '2px 0 0' }}>{flight.current_location?.trim()}</p>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '100%', height: '1px', background: '#ddd', position: 'relative' }}>
                      <span style={{ position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', fontSize: '1rem' }}>✈</span>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
                      {flight.departure_time?.trim()} → {flight.arrival_time?.trim()}
                    </p>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>
                      {flight.desired_location?.trim().slice(0, 3).toUpperCase()}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '2px 0 0' }}>{flight.desired_location?.trim()}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #f0ebe0' }}>
                  <div>
                    <p style={{ fontSize: '0.7rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '0 0 2px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>From</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, letterSpacing: '-0.02em' }}>₹{flight.price || 5000}</p>
                  </div>
                  <Link href={`/book/${flight.flight_code}?from=${encodeURIComponent(flight.current_location?.trim())}&to=${encodeURIComponent(flight.desired_location?.trim())}&departure=${encodeURIComponent(flight.departure_time?.trim())}&arrival=${encodeURIComponent(flight.arrival_time?.trim())}&flightName=${encodeURIComponent(flight.flight_name?.trim())}`}>
                    <button className="book-btn" style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '10px 24px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s', letterSpacing: '0.05em' }}>
                      Book →
                    </button>
                  </Link>
                </div>

              </div>
            ))}
          </div>
        )}
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
          {[['/flights', 'Flights'], ['/bookings', 'Bookings'], ['/checkin', 'Check-in'], ['/status', 'Status']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#f0ebe0', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </div>

    </div>
  )
}