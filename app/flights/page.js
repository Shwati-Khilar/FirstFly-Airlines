import Link from 'next/link'
import FlightCard from '@/app/components/FlightCard'

import db from '@/lib/db'
import {validTravelDate} from '@/lib/flight-card-schedule'
import { searchFlights } from '@/lib/flight-search'
export const dynamic = 'force-dynamic'
export default async function FlightsPage(props) {
  const searchParams = await props.searchParams
  const from = typeof searchParams?.from === 'string' ? searchParams.from : ''
  const to = typeof searchParams?.to === 'string' ? searchParams.to : ''
  const date = typeof searchParams?.date === 'string' ? searchParams.date : ''
  const hasDate = validTravelDate(date)
  let result = {flights:[],page:1,hasNext:false}, error = ''
  try { if (hasDate) result = await searchFlights(db, {from,to,date,page:searchParams?.page}) }
  catch { error = 'Unable to load flights. Please try again shortly.' }
  const filteredFlights = result.flights
  const pageLink = page => '/flights?' + new URLSearchParams({from,to,date,page:String(page)})

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif", background: '#f0ebe0', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .flight-card { transition: all 0.3s ease; border: 1px solid rgba(0,0,0,0.08); }
        .flight-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.12) !important; }
        .flight-results-main { flex:1; padding:48px clamp(16px,4vw,60px); }
        .flight-results-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr)); gap:24px; max-width:1440px; margin:0 auto; }
        @media(min-width:1400px){ .flight-results-grid{grid-template-columns:repeat(3,minmax(0,1fr));} }
        .book-btn:hover { background: #333 !important; }
      `}</style>

      {/* MAIN CONTENT */}
      <div className="flight-results-main">
        <div style={{ marginBottom: '48px' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '8px', textTransform: 'uppercase' }}>
            {from && to ? `${from} → ${to}` : 'All routes'}
          </p>
          <h1 style={{ fontSize: '3rem', fontWeight: 300, letterSpacing: '-0.02em', color: '#1a1a1a', margin: 0 }}>
            Available <em style={{ fontStyle: 'italic', fontWeight: 600 }}>Flights</em>
          </h1>
        </div>

        <form action="/flights" style={{display:'flex',flexWrap:'wrap',alignItems:'end',gap:16,marginBottom:32,fontFamily:"'DM Sans', sans-serif"}}>
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <label>Travel date<input aria-label="Travel date" type="date" name="date" required defaultValue={hasDate ? date : ''} style={{display:'block',padding:12,background:'white',border:'1px solid #ccc',borderRadius:8}} /></label>
          <button type="submit" style={{background:'#1a1a1a',color:'#f0ebe0',padding:'12px 24px',borderRadius:24}}>Search Flights</button>
        </form>
        {!hasDate ? <p role="status">Select a valid travel date to see available flights.</p> : error ? <p role="alert">{error}</p> : filteredFlights.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 300, color: '#888' }}>No flights found for this route 😔</p>
            <Link href="/">
              <button style={{ marginTop: '24px', background: '#1a1a1a', color: '#f0ebe0', padding: '12px 32px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem' }}>
                ← Back to Search
              </button>
            </Link>
          </div>
        ) : (
          <div className="flight-results-grid">
            {filteredFlights.map(flight => <FlightCard key={flight.flight_code} flight={flight} travelDate={date} />)}
          </div>
        )}
      </div>

      {hasDate && !error && <nav aria-label="Flight search pages" style={{display:'flex',gap:24,padding:'0 60px 32px'}}>
        {result.page > 1 && <Link href={pageLink(result.page-1)}>Previous</Link>}
        <span>Page {result.page}</span>
        {result.hasNext && <Link href={pageLink(result.page+1)}>Next</Link>}
      </nav>}
      {/* FOOTER */}
      <div style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '48px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
            FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.5, margin: 0 }}>© 2026 FirstFly. Elevate your journey.</p>
        </div>
        <div style={{ display: 'flex', gap: '32px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.6 }}>
          {[['/flights', 'Flights'], ['/my_trips', 'Bookings'], ['/checkin', 'Check-in'], ['/status', 'Status']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#f0ebe0', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </div>

    </div>
  )
}
