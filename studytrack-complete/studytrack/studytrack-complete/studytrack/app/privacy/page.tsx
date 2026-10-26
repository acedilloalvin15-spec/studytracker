import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'

export const metadata: Metadata = { title: 'Privacy Policy' }

// Change this if you want people to contact a different email address.
const CONTACT_EMAIL = 'acedilloalvin15@gmail.com'

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 26, 2026">
      <p>
        StudyTrack is a free study planner for students. This page explains what information the website collects, why, and
        what you can do about it.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your name and email address when you create an account, or when you sign in with Google.</li>
          <li>Your password, if you sign up with email. It is handled by our sign-in provider (Supabase) and stored in a protected form. We cannot read it.</li>
          <li>What you add to the app: subjects, deadlines, class schedule, exams, review plans, and the reviewers you make.</li>
          <li>Files you upload to the Reviewer maker, only while a reviewer is being made.</li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To run your account and show you your own deadlines, schedule, and reviewers.</li>
          <li>To send you the email that confirms your address or resets your password.</li>
          <li>To make a reviewer from a file you choose to upload.</li>
        </ul>
        <p className="mt-2">We do not sell your information and we do not show ads.</p>
      </section>

      <section>
        <h2>Files you upload and AI</h2>
        <p>
          When you make a reviewer, the text or file you upload is sent to Google&apos;s Gemini AI service so it can write the
          summary, flashcards, and quiz. Please do not upload private or sensitive documents. We keep the reviewer that is
          created, but we do not keep the original file.
        </p>
      </section>

      <section>
        <h2>Services that help us run StudyTrack</h2>
        <ul>
          <li>Supabase stores accounts and your study data.</li>
          <li>Vercel hosts the website.</li>
          <li>Google provides Google sign-in (if you choose it) and the Gemini AI.</li>
        </ul>
      </section>

      <section>
        <h2>Data saved on your device</h2>
        <p>
          To work offline, the app saves a copy of your latest study data and the pages you opened in your browser. Logging out
          removes that copy from the device.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>You can change your name and details in Settings.</li>
          <li>You can delete your reviewers, tasks, and other items at any time.</li>
          <li>You can delete your whole account in Settings. This permanently removes your data.</li>
        </ul>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          StudyTrack is meant for students. If you are young, please ask a parent or teacher before you sign up.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update this page, and the date at the top will change. Questions about your data? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  )
}
