'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import QRCode from 'react-qr-code'
import { useRef, Suspense } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function ConfirmationInner() {
  const params = useSearchParams()
  const ticketRef = useRef()

  const pnr = params.get('pnr') || '----'
  const name = params.get('name') || 'Guest'
  const flight = params.get('flight') || '---'
  const seat = params.get('seat') || 'N/A'
  const travelClass = params.get('class') || 'Economy'
  const price = params.get('price') || '5000'
  const from = params.get('from') || '---'
  const to = params.get('to') || '---'
  const departure = params.get('departure') || '--:--'
  const arrival = params.get('arrival') || '--:--'
  const flightName = params.get('flightName') || 'FirstFly'

  const getCode = (city) => {
    const map = { Delhi: 'DEL', Mumbai: 'BOM', Bangalore: 'BLR', Chennai: 'MAA' }
    return map[city] || city?.slice(0, 3).toUpperCase() || '???'
  }

  const downloadPDF = async () => {
    const element = ticketRef.current
    if (!element) return
    await document.fonts.ready
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      foreignObjectRendering: false,
      onclone: (clonedDoc, clonedEl) => {
        clonedEl.style.fontFamily = "'Cormorant Garamond', Georgia, serif"
        const allEls = clonedEl.querySelectorAll('*')
        allEls.forEach(el => {
          el.style.webkitPrintColorAdjust = 'exact'
          el.style.printColorAdjust = 'exact'
        })
      }
    })
    const imgData = canvas.toDataURL('image/png', 1.0)
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [220, 100] })
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`FirstFly_Boarding_${pnr}.pdf`)
  }

  return (
    // ── KEY FIX: remove justifyContent:'center', use flexDirection:'column' only
    <div style={{
      fontFamily: "'Cormorant Garamond', Georgia, serif",
      background: '#f0ebe0',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .dl-btn:hover { background: #333 !important; }
        .ticket-wrapper { animation: ticketIn 0.8s cubic-bezier(.22,1,.36,1) both; }
        @keyframes ticketIn { from { opacity:0; transform: scale(0.95) translateY(20px); } to { opacity:1; transform: scale(1) translateY(0); } }
        .action-btn:hover { opacity: 0.85; transform: translateY(-1px); }
      `}</style>

      {/* ── MAIN CONTENT — flex:1 so it fills space and pushes footer down */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px 60px',
      }}>

        {/* HEADING */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '8px', textTransform: 'uppercase' }}>
            Booking Confirmed ✦
          </p>
          <h1 style={{ fontSize: '3rem', fontWeight: 300, letterSpacing: '-0.02em', margin: 0 }}>
            Your <em style={{ fontStyle: 'italic', fontWeight: 600 }}>Boarding Pass</em>
          </h1>
        </div>

        {/* ── TICKET ── */}
        <div
          ref={ticketRef}
          className="ticket-wrapper"
          style={{
            width: '100%',
            maxWidth: '860px',
            background: 'white',
            borderRadius: '24px',
            overflow: 'hidden',
            boxShadow: '0 40px 80px rgba(0,0,0,0.15)',
            display: 'flex',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
          }}
        >
          {/* LEFT PANEL */}
          <div style={{ flex: 1, padding: '40px', background: '#ffffff' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#aaa', fontFamily: "'DM Sans', sans-serif", margin: '0 0 4px', textTransform: 'uppercase' }}>Passenger</p>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 500, margin: 0, color: '#1a1a1a' }}>{name}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.15em', color: '#aaa', fontFamily: "'DM Sans', sans-serif", margin: '0 0 4px', textTransform: 'uppercase' }}>Flight</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#1a1a1a' }}>
                  {flightName} <span style={{ color: '#aaa', fontWeight: 300 }}>#{flight}</span>
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px', padding: '24px', background: '#f8f6f2', borderRadius: '16px' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <p style={{ fontSize: '2.8rem', fontWeight: 700, margin: 0, letterSpacing: '-0.04em', color: '#1a1a1a' }}>{getCode(from)}</p>
                <p style={{ fontSize: '0.85rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '4px 0 0' }}>{from}</p>
                <p style={{ fontSize: '1rem', fontWeight: 500, margin: '6px 0 0', fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{departure}</p>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: '100%', height: '1px', background: '#ddd', position: 'relative', margin: '0 auto 8px' }}>
                  <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', fontSize: '1.4rem' }}>✈</span>
                </div>
                <p style={{ fontSize: '0.65rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Direct</p>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <p style={{ fontSize: '2.8rem', fontWeight: 700, margin: 0, letterSpacing: '-0.04em', color: '#1a1a1a' }}>{getCode(to)}</p>
                <p style={{ fontSize: '0.85rem', color: '#888', fontFamily: "'DM Sans', sans-serif", margin: '4px 0 0' }}>{to}</p>
                <p style={{ fontSize: '1rem', fontWeight: 500, margin: '6px 0 0', fontFamily: "'DM Sans', sans-serif", color: '#1a1a1a' }}>{arrival}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
              <QRCode value={`PNR:${pnr}|Name:${name}|Flight:${flight}|Seat:${seat}`} size={130} bgColor="#ffffff" fgColor="#1a1a1a" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', textAlign: 'center' }}>
              {[{ label: 'Seat', value: seat }, { label: 'Class', value: travelClass }, { label: 'Price', value: `₹${price}` }, { label: 'PNR', value: pnr }].map(item => (
                <div key={item.label} style={{ padding: '12px', background: '#f8f6f2', borderRadius: '10px' }}>
                  <p style={{ fontSize: '0.6rem', letterSpacing: '0.15em', color: '#aaa', fontFamily: "'DM Sans', sans-serif", margin: '0 0 4px', textTransform: 'uppercase' }}>{item.label}</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#1a1a1a' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* DASHED DIVIDER */}
          <div style={{ width: '2px', borderLeft: '2px dashed #e0d9ce', margin: '24px 0', flexShrink: 0 }} />

          {/* RIGHT STUB */}
          <div style={{ width: '200px', flexShrink: 0, background: '#1a1a1a', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', color: '#f0ebe0' }}>
            <div style={{ textAlign: 'center', width: '100%' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 16px', color: '#f0ebe0', fontFamily: "'DM Sans', sans-serif" }}>FirstFly</p>
              <p style={{ fontSize: '0.58rem', letterSpacing: '0.18em', color: '#666', fontFamily: "'DM Sans', sans-serif", margin: '0 0 3px', textTransform: 'uppercase' }}>Passenger</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0 0 14px', color: '#f0ebe0' }}>{name}</p>
              <p style={{ fontSize: '0.58rem', letterSpacing: '0.18em', color: '#666', fontFamily: "'DM Sans', sans-serif", margin: '0 0 3px', textTransform: 'uppercase' }}>Flight</p>
              <p style={{ fontSize: '0.95rem', fontWeight: 500, margin: '0 0 14px', color: '#f0ebe0' }}>#{flight}</p>
              <p style={{ fontSize: '0.58rem', letterSpacing: '0.18em', color: '#666', fontFamily: "'DM Sans', sans-serif", margin: '0 0 3px', textTransform: 'uppercase' }}>Seat</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, margin: '0 0 20px', letterSpacing: '-0.02em', color: '#f0ebe0' }}>{seat}</p>
              <p style={{ fontSize: '0.58rem', letterSpacing: '0.18em', color: '#666', fontFamily: "'DM Sans', sans-serif", margin: '0 0 3px', textTransform: 'uppercase' }}>Class</p>
              <p style={{ fontSize: '0.88rem', fontWeight: 500, margin: '0 0 20px', color: '#f0ebe0' }}>{travelClass}</p>
            </div>
            <div style={{ padding: '8px', background: '#f0ebe0', borderRadius: '10px' }}>
              <QRCode value={`PNR:${pnr}`} size={90} bgColor="#f0ebe0" fgColor="#1a1a1a" />
            </div>
            <p style={{ fontSize: '0.6rem', color: '#555', fontFamily: "'DM Sans', sans-serif", marginTop: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Gate Scan</p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
          <button onClick={downloadPDF} className="dl-btn action-btn"
            style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '14px 32px', borderRadius: '100px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.08em', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📄 Download Boarding Pass
          </button>
          <Link href="/flights">
            <button className="action-btn"
              style={{ background: 'white', color: '#1a1a1a', padding: '14px 32px', borderRadius: '100px', border: '1px solid #ddd', cursor: 'pointer', fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.08em', transition: 'all 0.2s' }}>
              Book Another Flight →
            </button>
          </Link>
        </div>

        <p style={{ marginTop: '24px', fontSize: '0.85rem', color: '#aaa', fontFamily: "'DM Sans', sans-serif" }}>
          Have a pleasant journey with FirstFly ✦
        </p>

      </div>

      {/* ── FOOTER — sits naturally at bottom because outer div is flex column */}
      <div style={{ background: '#1a1a1a', color: '#f0ebe0', padding: '48px 60px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>
            FirstFly <span style={{ fontWeight: 300 }}>Airways</span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.5, margin: 0 }}>© 2026 FirstFly. Elevate your journey.</p>
        </div>
        <div style={{ display: 'flex', gap: '32px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', opacity: 0.6 }}>
          {[['/flights', 'Flights'], ['/checkin', 'Check-in'], ['/status', 'Status'], ['/my-trips', 'My Trips']].map(([href, label]) => (
            <Link key={href} href={href} style={{ color: '#f0ebe0', textDecoration: 'none' }}>{label}</Link>
          ))}
        </div>
      </div>

    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Georgia, serif', fontSize: '1.2rem', color: '#888' }}>
        Loading...
      </div>
    }>
      <ConfirmationInner />
    </Suspense>
  )
}