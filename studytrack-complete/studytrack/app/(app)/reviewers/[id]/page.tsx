import type { Metadata } from 'next'
import { ReviewerDetail } from '@/components/reviewers/reviewer-detail'

export const metadata: Metadata = { title: 'Reviewer' }

export default async function ReviewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReviewerDetail id={id} />
}
