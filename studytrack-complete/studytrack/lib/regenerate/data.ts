// ============================================================
// ADAPT THIS FILE to your own database / auth.
// The route only calls these three functions.
// ============================================================

export type Flashcard = { question: string; answer: string };
export type QuizQuestion = {
  question: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
};

export type Reviewer = {
  id: string;
  summary: string;
  keyTerms: unknown;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
};

/** Return the id of the logged-in user, or null if not signed in. */
export async function getCurrentUserId(): Promise<string | null> {
  // TODO: e.g. Supabase: const { data } = await supabase.auth.getUser(); return data.user?.id ?? null;
  throw new Error("Implement getCurrentUserId in lib/regenerate/data.ts");
}

/** Load a reviewer ONLY if it belongs to userId. Return null otherwise. */
export async function getReviewer(id: string, userId: string): Promise<Reviewer | null> {
  // TODO: e.g. select * from reviewers where id = $1 and user_id = $2
  throw new Error("Implement getReviewer in lib/regenerate/data.ts");
}

/** Replace just one section of the reviewer. */
export async function saveReviewerSection(
  id: string,
  userId: string,
  kind: "flashcards" | "quiz",
  items: Flashcard[] | QuizQuestion[]
): Promise<void> {
  // TODO: e.g. update reviewers set <kind> = $1 where id = $2 and user_id = $3
  throw new Error("Implement saveReviewerSection in lib/regenerate/data.ts");
}
