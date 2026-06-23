import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Compass',
    short_name: 'Compass',
    description: 'Your trading performance operating system',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAFAF9',
    theme_color: '#1A1A19',
    icons: [
      { src: '/icon.svg',       sizes: 'any',    type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg',       sizes: 'any',    type: 'image/svg+xml', purpose: 'maskable' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    categories: ['finance', 'productivity'],
  }
}
