// The assistant answers from these help articles first, so its answers about StudyTrack stay accurate.
// Edit or add articles here. Each article has keywords that help find it for a question.

export type HelpArticle = {
  id: string
  title: string
  keywords: string[]
  body: string
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'getting-started',
    title: 'Getting started with StudyTrack',
    keywords: ['start', 'begin', 'new', 'setup', 'set up', 'first', 'signup', 'sign up', 'account', 'login', 'log in'],
    body: `StudyTrack is a study planner for students. To begin, create an account with your email or sign in with Google.
A good first step is to add your subjects, then add your class schedule, then add tasks and exams. The dashboard shows what is due soon.`,
  },
  {
    id: 'subjects',
    title: 'Subjects',
    keywords: ['subject', 'subjects', 'class', 'course', 'color', 'colour'],
    body: `The Subjects page lists your subjects. Each subject has a name and a color, so its tasks, exams and reviewers are easy to spot.
Add a subject before you add tasks or a reviewer that belongs to it.`,
  },
  {
    id: 'schedule',
    title: 'Weekly class schedule',
    keywords: ['schedule', 'timetable', 'class time', 'weekly', 'monday', 'tuesday', 'classes'],
    body: `The Schedule page is your weekly class timetable. Add each class with its subject, day and time.
Your classes also appear on the Calendar and the Dashboard.`,
  },
  {
    id: 'tasks',
    title: 'Tasks and deadlines',
    keywords: ['task', 'tasks', 'deadline', 'due', 'assignment', 'homework', 'todo', 'to do', 'complete', 'mark done', 'checkbox'],
    body: `The Tasks page holds your assignments and to-dos. Each task can have a subject, a due date and a done checkbox.
Tasks due soon show on the Dashboard, and reminders appear in the notification bell.`,
  },
  {
    id: 'exams-and-review-plan',
    title: 'Exams and the review plan',
    keywords: ['exam', 'exams', 'test', 'quiz', 'review plan', 'study plan', 'review', 'revise', 'revision', 'plan', 'prepare'],
    body: `The Review page lets you add an exam with its date and subject. StudyTrack then makes a day-by-day review plan,
spreading study sessions over the days before the exam. Mark a session as done when you finish it.`,
  },
  {
    id: 'reviewer-maker',
    title: 'Reviewer maker',
    keywords: ['reviewer', 'reviewers', 'notes', 'upload', 'pdf', 'word', 'docx', 'txt', 'summary', 'key terms', 'paste', 'make a reviewer', 'create reviewer'],
    body: `The Reviewer page turns your notes into a study reviewer. Upload a PDF, Word (.docx) or text (.txt) file, or paste your text.
Choose how many quiz questions you want (5, 10 or 15). StudyTrack then builds a summary, key terms, flashcards and a practice quiz.
The reviewer is made with simple rules, not AI, so every answer comes from your own text.
Files must be under 4 MB. Scanned pages and pictures cannot be read. Save your PDF as a text-based file if it does not work.
You can make new quiz questions or flashcards from the same reviewer with the New quiz and New flashcards buttons.`,
  },
  {
    id: 'calendar',
    title: 'Calendar',
    keywords: ['calendar', 'month', 'month view', 'deadlines', 'view'],
    body: `The Calendar page shows a monthly view of your deadlines, exams and classes, so you can see the whole month at a glance.`,
  },
  {
    id: 'reminders',
    title: 'Reminders and notifications',
    keywords: ['reminder', 'reminders', 'notification', 'notifications', 'bell', 'alert', 'alerts', 'email reminder'],
    body: `Reminders appear in the notification bell inside the app. You can choose when to be reminded in Settings:
three days before, one day before, or on the due day.
The Email reminders switch only saves your choice. Emails are not sent yet.`,
  },
  {
    id: 'settings-and-account',
    title: 'Settings, profile and account',
    keywords: ['settings', 'profile', 'password', 'theme', 'dark mode', 'light mode', 'avatar', 'picture', 'delete account', 'delete my account', 'change password', 'name'],
    body: `The Settings page lets you update your profile, school and year level, reminder preferences and theme (light or dark).
You can change your password there too. You can add a profile picture, and you can delete your account. Deleting your account removes your study data.`,
  },
  {
    id: 'offline-and-install',
    title: 'Using StudyTrack offline and on your phone',
    keywords: ['offline', 'no internet', 'install', 'app', 'android', 'phone', 'apk', 'iphone', 'home screen', 'pwa', 'sync'],
    body: `StudyTrack works as a web app. You can install it on your phone's home screen from the browser menu, or download the Android app from the site.
Some things work offline: you can view your data, and changes you make offline are saved and synced when you are back online.
Making a reviewer from a PDF or Word file needs internet. Pasted text and .txt files work offline.`,
  },
  {
    id: 'privacy-and-data',
    title: 'Privacy and your data',
    keywords: ['privacy', 'data', 'safe', 'secure', 'security', 'share', 'private', 'who can see', 'delete data'],
    body: `Only you can see your study data. Your data is protected so each student sees only their own information.
Do not upload private or sensitive documents. We do not keep the original file you upload to make a reviewer.
You can read the full Privacy Policy on the privacy page, and you can delete your account in Settings.`,
  },
]

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'is', 'are', 'was', 'be', 'i', 'my', 'me', 'how',
  'do', 'does', 'can', 'what', 'where', 'when', 'why', 'it', 'this', 'that', 'with', 'at', 'from', 'your', 'you',
  'please', 'help', 'want', 'need', 'make', 'get', 'use',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
}

/** Picks the help articles that best match a question. Simple keyword scoring, no AI needed. */
export function findHelpArticles(question: string, limit = 3): HelpArticle[] {
  const words = new Set(tokenize(question))
  if (words.size === 0) return []
  const lowered = question.toLowerCase()

  const scored = HELP_ARTICLES.map((article) => {
    let score = 0
    for (const keyword of article.keywords) {
      // Phrases (e.g. "review plan") match as a whole; single words match any word in the question.
      if (keyword.includes(' ') ? lowered.includes(keyword) : words.has(keyword)) score += 2
    }
    for (const word of tokenize(article.title)) if (words.has(word)) score += 1
    return { article, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.article)
}
