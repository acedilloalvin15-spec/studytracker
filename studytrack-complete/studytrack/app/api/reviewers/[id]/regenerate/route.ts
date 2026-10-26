import { NextResponse } from "next/server";
import { callGeminiJson } from "@/lib/regenerate/gemini";
import {
  getCurrentUserId,
  getReviewer,
  saveReviewerSection,
} from "@/lib/regenerate/data";

// Gemini can take a while; avoid Vercel default short timeout.
export const maxDuration = 60;

const STYLES: Record<string, string> = {
  fresh: "a fresh angle, mixed difficulty",
  easier: "easier, focused on definitions and basics",
  harder: "harder, focused on application and scenario-based thinking",
};

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { kind, style } = await req.json();
    if (kind !== "flashcards" && kind !== "quiz") {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    const reviewer = await getReviewer(params.id, userId);
    if (!reviewer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const previous = reviewer[kind as "flashcards" | "quiz"];
    const count = previous.length || 10;
    const styleText = STYLES[style as string] ?? STYLES.fresh;

    const shape =
      kind === "quiz"
        ? `[{"question": "...", "choices": ["...","...","...","..."], "answerIndex": 0, "explanation": "..."}]`
        : `[{"question": "...", "answer": "..."}]`;

    const prompt = `You are creating study material from the reviewer below.

SUMMARY:
${reviewer.summary}

KEY TERMS:
${JSON.stringify(reviewer.keyTerms)}

Create exactly ${count} NEW ${
      kind === "quiz" ? "multiple-choice quiz questions (4 choices each)" : "flashcards"
    }.
Style: ${styleText}.
Use only facts supported by the summary and key terms.
Do NOT reuse or closely paraphrase any of these existing items:
${JSON.stringify(previous)}

Return ONLY valid JSON in exactly this shape (an array):
${shape}`;

    const items = await callGeminiJson(prompt);

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Gemini did not return a non-empty array");
    }

    // Save only after a valid result, so a failure never wipes the old set.
    await saveReviewerSection(params.id, userId, kind, items as any);

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Regenerate failed:", err); // visible in Vercel -> Logs
    return NextResponse.json({ error: "Could not regenerate" }, { status: 500 });
  }
}
