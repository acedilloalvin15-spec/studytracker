import type { Metadata } from 'next'
import { ReviewersView } from '@/components/reviewers/reviewers-view'

export const metadata: Metadata = { title: 'Reviewer' }

export default function ReviewersPage() {
  return <ReviewersView />
}
