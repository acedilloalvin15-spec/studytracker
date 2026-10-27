import { SiteHeader } from '@/components/landing/site-header'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { SiteFooter } from '@/components/landing/site-footer'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={!!user} />
      <main className="flex-1">
        <Hero signedIn={!!user} />
        <a 
          href="/StudyTrack.apk" 
          download 
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
          Download Android App (.apk)
      </a>
        <Features />
        <HowItWorks />
      </main>
      <SiteFooter />
    </div>
  )
}
