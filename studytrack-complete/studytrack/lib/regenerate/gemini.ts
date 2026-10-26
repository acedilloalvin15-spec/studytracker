// Minimal Gemini helper using fetch (no extra dependency).
// Requires GEMINI_API_KEY in your environment (Vercel -> Settings -> Environment Variables).
// Optional: GEMINI_MODEL (defaults to gemini-2.5-flash). Change it if your model name is retired.

export async function callGeminiJson(prompt: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 1.0, // higher = more variety between regenerations
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");

  // Strip accidental code fences, then parse.
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
