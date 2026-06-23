import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: 32, height: 32, background: '#1A1A19', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#EFEFEE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    </div>,
    { ...size },
  )
}
