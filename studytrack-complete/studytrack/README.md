# StudyTrack

A free study planner for students: deadlines, weekly class schedule, exam review planner, calendar, and reminders.

Built with Next.js, Tailwind CSS, shadcn/ui, and Supabase (login + database).

## Pages

| Page | What it does |
| --- | --- |
| `/` | Landing page |
| `/signup`, `/login`, `/forgot-password`, `/reset-password` | Accounts (email + password, Google optional) |
| `/dashboard` | Today's summary, upcoming deadlines, classes, and review plan |
| `/tasks` | Add, edit, delete, and complete deadlines; filter, search, sort |
| `/subjects` | Your subjects and their colors |
| `/schedule` | Weekly class timetable |
| `/review` | Exams and the automatic day-by-day review plan |
| `/reviewers` | Upload a PDF, Word, or text file (or paste text) and get a summary, key terms, flashcards, and a practice quiz. Built with simple rules, no AI needed |
| `/calendar` | Monthly view of deadlines, exams, and classes |
| `/assistant` | Study assistant chat: asks about the app, guides students, and quizzes them on a reviewer |
| `/settings` | Profile, reminders, theme, change password, delete account |

## Set up on your computer (step by step)

1. Install **Node.js 20 or newer** from nodejs.org.
2. Open a terminal in this folder and run: `npm install`
3. Create a free project at **supabase.com**.
4. In Supabase, open **SQL Editor > New query**, paste everything from `supabase/schema.sql`, and click **Run**.
5. In Supabase, open **Project Settings > API** and copy the **Project URL** and the **anon public key**.
6. Copy `.env.example` to a new file named `.env.local`, then paste the two values in.
7. In Supabase, open **Authentication > URL Configuration**. Set **Site URL** to `http://localhost:3000` and add `http://localhost:3000/auth/callback` under **Redirect URLs**.
8. Run `npm run dev` and open http://localhost:3000.
9. Sign up. If Supabase asks you to confirm your email, check your inbox, click the link, then log in.

Tip: while testing, you can turn off **Authentication > Providers > Email > Confirm email** so signup logs you in right away. Turn it back on before launching.

## Put it online (Vercel, step by step)

1. Upload this folder to a new GitHub repository.
2. Go to **vercel.com**, click **Add New > Project**, and pick the repository.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and `NEXT_PUBLIC_SITE_URL` with your final web address).
4. Click **Deploy**.
5. Copy your live address (for example `https://studytrack.vercel.app`). In Supabase **Authentication > URL Configuration**, set **Site URL** to it and add `https://YOUR-ADDRESS/auth/callback` under **Redirect URLs**.
6. Open the live site, sign up, and test every page on your phone.

## Optional: Google sign-in

1. In Google Cloud Console, create an **OAuth client ID** (Web application).
2. Add the callback URL shown in Supabase under **Authentication > Providers > Google**.
3. Paste the Client ID and Client Secret into that Supabase page and enable it.

## Optional: "Delete my account" button

Add `SUPABASE_SERVICE_ROLE_KEY` (from Supabase **Project Settings > API**) to your environment variables. Never share this key or put it in browser code. Without it, the button shows a friendly message instead of deleting.

## Good to know

- Reminders appear in the notification bell inside the app. The "Email reminders" switch only saves your choice; sending emails would need a scheduled job, which is not included.
- All data is protected with Row Level Security, so each student only sees their own rows.

## Study assistant (no AI, no API key)

The assistant needs no setup beyond the `supabase/assistant.sql` file (run once in Supabase; new installs already get it from `schema.sql`). It does not call any AI service, so it costs nothing to run.

How it works:
- It answers StudyTrack questions from the help articles in `lib/assistant/knowledge.ts`. Edit or add articles there.
- If a student picks a reviewer, it can give a summary, a random quiz question, flashcards, definitions of key terms, or the reviewer sentences that best match the question.
- It gives short study tips and a friendly fallback when it does not know an answer.
- Students can rate answers with thumbs up or down (saved in `assistant_messages.feedback`) and clear their own chat.
- Its answers come from rules and matching, not from an AI model, so it cannot answer general questions outside the app and its reviewers.

## Reviewer maker (no AI)

The reviewer maker runs **without any AI and needs no API key or setup**. It reads headings, glossary lines, definitions, names, dates and numbers in the student's text and builds the summary, key terms, flashcards and quiz from them, so every answer is copied from the student's own notes. The "New quiz" and "New flashcards" buttons work the same way.

**Accuracy check** (`lib/reviewer-verify.ts`): before a reviewer is saved, every answer is compared with the student's text. Unsupported answers, duplicate or ambiguous quiz questions, and questions that give away their own answer are dropped.

- The text is processed on our own server (or on the phone when offline) and is not sent to any AI service. Each reviewer keeps only the generated content, never the original file.
- Offline, pasted text and `.txt` files use the same rules on the phone.
- PDF and Word files are read by the server (no file is kept) and need internet. Files must be under 4 MB (a Vercel limit). Scanned pages and pictures can't be read.

## Using StudyTrack on an Android phone

StudyTrack works in any phone browser, and it can be installed like an app:

1. Open your live website in **Chrome** on the Android phone and log in.
2. Tap the **three dots** at the top right.
3. Tap **Install app** (or **Add to Home screen**), then tap **Install**.
4. Open StudyTrack from the new icon on the home screen. It opens full screen like a normal app.

It needs an internet connection to load and save data.

## Real email addresses only

StudyTrack checks the email twice:

1. **Before signup** (`/api/auth/check-email`): it blocks typos like `gmial.com`, common temporary-inbox sites, and domains that do not exist or cannot receive email.
2. **After signup**: the student must click the confirmation link we email them. An address that does not exist can never be confirmed, so it can never log in. This is the part that truly proves the email is real.

To turn the confirmation on:

1. In Supabase, open **Authentication > Sign In / Providers > Email** and turn **Confirm email** ON, then **Save**.
2. Set up your own email sender, because Supabase's built-in sender only emails your own team members and is limited to about 2 emails per hour. Open **Authentication > Emails > SMTP Settings**, turn on **Enable custom SMTP**, and enter the details from an email service such as Brevo. Use the SMTP login and SMTP key the service gives you, plus a sender email you verified with that service.
3. Test with a second real email address: sign up, open the email, click the link, then log in.

Notes: no website can know an address is real without sending a message to it, which is why the confirmation email matters. The list of temporary-inbox sites is a short one, not complete.

## Using StudyTrack offline

- The app saves the pages you open and your latest deadlines, subjects, schedule, exams, and reviewers on the device.
- Without internet, you can still open pages you have visited before and read your saved data. An "You're offline" note appears.
- Adding, editing, deleting, and making new reviewers need internet.
- Open the app once online first, so there is something to save. The first visit always needs internet.
- Logging out removes the saved copy from that device.
- Offline mode only runs on the live (production) site, not in `npm run dev`.
