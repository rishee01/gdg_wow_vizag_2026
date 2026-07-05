import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { SystemProvider } from '@/context/SystemContext'
import { Sidebar } from '@/components/sidebar'

const _geistSans = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PulseControl AI — Incident Intelligence Platform',
  description: 'DevOps real-time incident triage and automated remediation dashboard',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a0a0a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-zinc-950">
      <body className="antialiased">
        <SystemProvider>
          <div className="flex h-screen w-screen overflow-hidden bg-black text-slate-100 font-sans">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-zinc-950/40 relative">
              {children}
            </main>
          </div>
        </SystemProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

