import { NextResponse } from "next/server";
import { regenerateSection, ReviewerError, type Style } from "@/lib/reviewer-generator";
import { verifyContent } from "@/lib/reviewer-verify";
import {
  getCurrentUserId,
  getReviewer,
  saveReviewerSection,
} from "@/lib/regenerate/data";

// New flashcards / quiz questions are built from the reviewer itself with simple rules (no AI, no internet),
// so every answer still comes from the student's own material.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const { kind, style } = await req.json();
    if (kind !== "flashcards" && kind !== "quiz") {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const styleKey: Style = style === "easier" || style === "harder" ? style : "fresh";

    const reviewer = await getReviewer(id, userId);
    if (!reviewer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const previous = reviewer[kind as "flashcards" | "quiz"];
    const count = Math.min(15, previous.length || 10);
    const content = {
      summary: reviewer.summary,
      key_terms: reviewer.keyTerms,
      flashcards: reviewer.flashcards,
      quiz: reviewer.quiz,
    };

    let items: any[];
    try {
      items = regenerateSection(content, kind, { count, style: styleKey }) as any[];
    } catch (err) {
      if (err instanceof ReviewerError) {
        return NextResponse.json(
          { error: "There is not enough material in this reviewer to make a new set." },
          { status: 422 }
        );
      }
      throw err;
    }

    // Accuracy check against what this reviewer says. Anything unsupported is dropped.
    const material = [
      reviewer.summary,
      reviewer.keyTerms.map((t: any) => `${t.term}: ${t.definition}`).join("\n"),
      ...reviewer.quiz.map((q: any) => q.explanation ?? ""),
      ...reviewer.flashcards.map((c: any) => c.answer ?? ""),
    ].join("\n\n");
    const checked = verifyContent(
      { summary: "", key_terms: [], flashcards: kind === "flashcards" ? items : [], quiz: kind === "quiz" ? items : [] },
      material
    ).content;
    items = kind === "quiz" ? checked.quiz : checked.flashcards;

    if (items.length < 3) {
      return NextResponse.json(
        { error: "There is not enough material in this reviewer to make a new set." },
        { status: 422 }
      );
    }

    // Save only after a valid result, so a failure never wipes the old set.
    await saveReviewerSection(id, userId, kind, items);

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Regenerate failed:", err); // visible in Vercel -> Logs
    return NextResponse.json({ error: "Could not regenerate" }, { status: 500 });
  }
}
