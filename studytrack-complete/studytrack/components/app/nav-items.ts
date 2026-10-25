import {
  BookMarked,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Settings,
} from 'lucide-react'

export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/subjects', label: 'Subjects', icon: BookMarked },
  { href: '/schedule', label: 'Schedule', icon: CalendarRange },
  { href: '/review', label: 'Review', icon: GraduationCap },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export const MOBILE_NAV = ['/dashboard', '/tasks', '/schedule', '/review', '/calendar']
