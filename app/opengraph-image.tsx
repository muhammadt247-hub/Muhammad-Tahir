import { ImageResponse } from 'next/og';

// The picture shown when someone shares a link to the site (WhatsApp, Facebook, X, LinkedIn)
export const alt = 'OrbinexaCSV: AI metadata and CSV files for stock contributors';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'radial-gradient(ellipse at 20% 0%, #8f1a0c 0%, #2a0d07 45%, #0d0907 80%)',
          color: '#f6ece6',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: '#f9641f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 56,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            O
          </div>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800 }}>
            Orbinexa<span style={{ color: '#f9641f' }}>CSV</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, marginTop: 48, lineHeight: 1.2 }}>
          AI titles, keywords and upload-ready CSV files
        </div>
        <div style={{ display: 'flex', fontSize: 32, marginTop: 20, color: '#c5bab4' }}>
          For Adobe Stock, Shutterstock and Freepik contributors
        </div>
      </div>
    ),
    { ...size }
  );
}
