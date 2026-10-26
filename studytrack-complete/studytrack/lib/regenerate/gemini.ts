// Minimal Gemini helper using fetch (no extra dependency).
// Needs GEMINI_API_KEY in Vercel. Optional: GEMINI_MODEL (default gemini-2.5-flash).

export async function callGeminiJson(prompt: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Stop at 50s so we fail with a clear error before Vercel's 60s limit.
    signal: AbortSignal.timeout(50_000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 1.0, // more variety between regenerations
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no text')

  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
