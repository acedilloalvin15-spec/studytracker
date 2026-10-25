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
| `/reviewers` | Upload a PDF, Word, or text file and get a summary, key terms, flashcards, and a practice quiz (uses Google Gemini) |
| `/calendar` | Monthly view of deadlines, exams, and classes |
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

## AI Reviewer setup (Gemini)

1. In Supabase **SQL Editor**, run `supabase/reviewers.sql` once (new installs already get it from `schema.sql`).
2. Go to **aistudio.google.com**, sign in, click **Get API key**, and create a key.
3. In Vercel, open **Settings > Environment Variables** and add `GEMINI_API_KEY` with your key. Use the name exactly, with no `NEXT_PUBLIC_` in front, so the key stays private on the server.
4. Optional: add `GEMINI_MODEL` if you want a different model than the default (`gemini-flash-latest`). Google changes model names from time to time, and AI Studio shows which ones are free for your key.
5. Redeploy from the **Deployments** tab.

Good to know:
- Files must be under 4 MB (a Vercel limit). Supported: PDF, DOCX, TXT. Save PowerPoint or old .doc files as PDF first.
- The free Gemini tier has small daily limits that Google can change. When the limit is reached, the page asks the student to try again later.
- On the free tier, Google may use what you send to improve its products, so tell students not to upload private documents.

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
