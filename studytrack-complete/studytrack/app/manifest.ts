import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'StudyTrack',
    short_name: 'StudyTrack',
    description: 'Track deadlines, plan your week, and review every subject before exams.',
    lang: 'en',
    categories: ['education', 'productivity'],
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f8fc',
    theme_color: '#4f46e5',
    shortcuts: [
      { name: 'Deadlines', short_name: 'Tasks', url: '/tasks', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Schedule', short_name: 'Schedule', url: '/schedule', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Reviewer maker', short_name: 'Reviewer', url: '/reviewers', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
