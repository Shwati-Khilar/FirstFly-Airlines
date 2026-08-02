'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const handleSearch = () => {
    if (from && to) router.push(`/flights?from=${from}&to=${to}`)
  }

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', 'Georgia', serif", background: '#f0ebe0', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        .hero-img { animation: floatUp 1.2s cubic-bezier(.22,1,.36,1) both; }
        @keyframes floatUp { from { opacity:0; transform: translateY(40px);} to { opacity:1; transform: translateY(0);} }
        .fade-in { animation: fadeIn 1s ease both; }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .slide-up { animation: slideUp 0.9s cubic-bezier(.22,1,.36,1) both; }
        @keyframes slideUp { from { opacity:0; transform:translateY(30px);} to { opacity:1; transform:translateY(0);} }
        .search-input:focus { outline: none; border-bottom: 2px solid #1a1a1a; }
        .book-btn:hover { background: #1a1a1a; transform: scale(1.03); }
        .dest-card:hover img { transform: scale(1.07); }
        .nav-link:hover { opacity: 0.6; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.1); }
      `}</style>

      {/* HERO SECTION */}
      <div style={{ position: 'relative', overflow: 'hidden', minHeight: '92vh', display: 'flex', flexDirection: 'column' }}>

        {/* BG texture */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 70% 40%, #e8dfc8 0%, #f0ebe0 60%)', zIndex: 0 }} />

        {/* NAVBAR */}
        {/* <nav style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 60px' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
          </div>
          <div style={{ display: 'flex', gap: '36px', fontSize: '0.85rem', letterSpacing: '0.1em', fontFamily: "'DM Sans', sans-serif" }}>
            {[['/', 'Home'], ['/flights', 'Flights'], ['/bookings', 'Bookings'], ['/checkin', 'Check-in'], ['/status', 'Status']].map(([href, label]) => (
              <Link key={href} href={href} className="nav-link" style={{ color: '#1a1a1a', textDecoration: 'none', transition: 'opacity 0.2s' }}>{label}</Link>
            ))}
          </div>
          <Link href="/flights">
            <button className="book-btn" style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '10px 28px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', letterSpacing: '0.08em', transition: 'all 0.2s', fontFamily: "'DM Sans', sans-serif" }}>
              Book Now
            </button>
          </Link>
        </nav> */}

        {/* HERO CONTENT */}
        <div style={{ position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px 60px 0', flex: 1 }}>

          <div className="slide-up" style={{ maxWidth: '520px' }}>
            <span style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', padding: '6px 16px', borderRadius: '100px', fontSize: '0.8rem', letterSpacing: '0.12em', fontFamily: "'DM Sans', sans-serif", color: '#555' }}>
              ✦ Your Premium Travel Service
            </span>

            <h1 style={{ fontSize: 'clamp(3rem, 5vw, 4.5rem)', fontWeight: 300, lineHeight: 1.1, margin: '20px 0 16px', letterSpacing: '-0.02em', color: '#1a1a1a' }}>
              Discover your<br />
              <em style={{ fontStyle: 'italic', fontWeight: 600 }}>flight</em> experience
            </h1>

            <p style={{ fontFamily: "'DM Sans', sans-serif", color: '#666', fontSize: '1rem', lineHeight: 1.7, marginBottom: '32px', fontWeight: 300 }}>
              Find countless flight options & deals to destinations<br />around the world
            </p>

            <Link href="/flights">
              <button className="book-btn" style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '14px 36px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', letterSpacing: '0.1em', transition: 'all 0.2s', fontFamily: "'DM Sans', sans-serif" }}>
                Explore Flights →
              </button>
            </Link>
          </div>

          <div className="hero-img" style={{ flex: '0 0 auto' }}>
            <img
              src="https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=900"
              alt="plane"
              style={{ width: 'clamp(300px, 40vw, 560px)', borderRadius: '24px', objectFit: 'cover', boxShadow: '0 40px 80px rgba(0,0,0,0.15)' }}
            />
          </div>
        </div>

        {/* SEARCH BOX */}
        <div className="fade-in" style={{ position: 'relative', zIndex: 10, margin: '40px 60px 60px', background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', borderRadius: '20px', padding: '28px 36px', boxShadow: '0 8px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.9)' }}>

          <div style={{ display: 'flex', gap: '0', alignItems: 'center', fontFamily: "'DM Sans', sans-serif" }}>

            <div style={{ flex: 1, borderRight: '1px solid #ddd', paddingRight: '24px' }}>
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>✈ From</div>
              <input
                className="search-input"
                value={from}
                onChange={e => setFrom(e.target.value)}
                placeholder="Origin city"
                style={{ width: '100%', border: 'none', borderBottom: '1px solid #ccc', background: 'transparent', fontSize: '1.1rem', padding: '4px 0', color: '#1a1a1a', transition: 'border 0.2s' }}
              />
            </div>

            <div style={{ width: '48px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', cursor: 'pointer' }}
                onClick={() => { setFrom(to); setTo(from) }}>⇄</div>
            </div>

            <div style={{ flex: 1, borderRight: '1px solid #ddd', paddingLeft: '24px', paddingRight: '24px' }}>
              <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: '#888', marginBottom: '6px', textTransform: 'uppercase' }}>✈ To</div>
              <input
                className="search-input"
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="Destination city"
                style={{ width: '100%', border: 'none', borderBottom: '1px solid #ccc', background: 'transparent', fontSize: '1.1rem', padding: '4px 0', color: '#1a1a1a', transition: 'border 0.2s' }}
              />
            </div>

            <div style={{ paddingLeft: '24px' }}>
              <button
                onClick={handleSearch}
                className="book-btn"
                style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '14px 32px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', whiteSpace: 'nowrap', transition: 'all 0.2s', letterSpacing: '0.05em' }}
              >
                Search Flights ✦
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ padding: '80px 60px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px', textTransform: 'uppercase' }}>Why choose us</p>
        <h2 style={{ fontSize: '2.8rem', fontWeight: 300, marginBottom: '60px', letterSpacing: '-0.02em' }}>
          Exclusivity <em style={{ fontStyle: 'italic', fontWeight: 600 }}>by Design</em>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
          {[
            { title: 'Total Privacy', desc: 'Encrypted passenger manifest ensures complete confidentiality at every step.', bg: 'white', color: '#1a1a1a' },
            { title: 'Swift Dispatch', desc: 'On-demand availability with confirmed bookings in under 60 seconds.', bg: '#1a1a1a', color: '#f0ebe0' },
            { title: 'Curated Comfort', desc: 'Premium seat selection and class upgrades tailored to you.', bg: 'white', color: '#1a1a1a' },
          ].map(f => (
            <div key={f.title} className="feature-card" style={{ background: f.bg, color: f.color, padding: '40px 32px', borderRadius: '20px', textAlign: 'left', transition: 'all 0.3s', cursor: 'default' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 500, marginBottom: '12px' }}>{f.title}</h3>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', lineHeight: 1.7, opacity: 0.75, fontWeight: 300 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DESTINATIONS */}
      <div style={{ padding: '0 60px 80px' }}>
        <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px', textTransform: 'uppercase' }}>Popular routes</p>
        <h2 style={{ fontSize: '2.8rem', fontWeight: 300, marginBottom: '40px', letterSpacing: '-0.02em' }}>
          Global <em style={{ fontStyle: 'italic', fontWeight: 600 }}>Reach</em>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[
            { city: 'Mumbai', img: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=400&q=80' },
            { city: 'Delhi', img: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=400&q=80' },
            { city: 'Bangalore', img: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=400&q=80' },
            { city: 'Chennai', img: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=400&q=80' },
          ].map(d => (
            <div key={d.city} className="dest-card" style={{ borderRadius: '16px', overflow: 'hidden', background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', cursor: 'pointer' }}
              onClick={() => router.push(`/flights?to=${d.city}`)}>
              <div style={{ overflow: 'hidden', height: '180px' }}>
                <img src={d.img} alt={d.city} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }} />
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, fontSize: '1rem' }}>{d.city}</span>
                <span style={{ fontSize: '0.8rem', color: '#888', fontFamily: "'DM Sans', sans-serif" }}>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '48px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
            FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.5 }}>© 2026 FirstFly. Elevate your journey.</p>
        </div>
        <div style={{ display: 'flex', gap: '32px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.6 }}>
          {[['/flights', 'Flights'], ['/bookings', 'Bookings'], ['/checkin', 'Check-in']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#f0ebe0', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </div>
    </div>
  )
}