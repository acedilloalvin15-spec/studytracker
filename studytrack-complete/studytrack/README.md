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
