import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: 180, height: 180, background: '#1A1A19', borderRadius: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={112} height={112} viewBox="0 0 24 24" fill="none" stroke="#EFEFEE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    </div>,
    { ...size },
  )
}
