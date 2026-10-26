import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = { title: 'Terms of Service' }

// Change this if you want people to contact a different email address.
const CONTACT_EMAIL = 'acedilloalvin15@gmail.com'

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 26, 2026">
      <p>By creating an account or using StudyTrack, you agree to these simple terms.</p>

      <section>
        <h2>Using StudyTrack</h2>
        <ul>
          <li>StudyTrack is a free tool to help you plan your studies. You may use it for your own personal study.</li>
          <li>Use a real email address that belongs to you, and keep your password private.</li>
          <li>You are responsible for what you add and upload. Do not upload anything illegal, private about other people, or that you do not have the right to use.</li>
          <li>Do not try to break, overload, or misuse the website or other people&apos;s accounts.</li>
        </ul>
      </section>

      <section>
        <h2>The AI reviewer</h2>
        <p>
          Reviewers are written by an AI and can contain mistakes. Always check important facts against your teacher&apos;s
          materials before you rely on them for an exam.
        </p>
      </section>

      <section>
        <h2>No guarantees</h2>
        <p>
          StudyTrack is provided as is. We try to keep it working, but we cannot promise it will always be available or free
          of errors, and the free AI service may have daily limits. Keep your own copy of anything important, such as the
          dates of deadlines and exams.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You can delete your account at any time in Settings. We may suspend accounts that break these terms.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms, and the date at the top will change. Continuing to use StudyTrack means you accept the
          new terms. Questions? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  )
}
