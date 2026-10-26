// Gemini helper. Uses the "latest" alias so you never have to rename models,
// and falls back to other names if one is ever retired (HTTP 404).

const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.6-flash']

export async function callGeminiJson(prompt: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  // GEMINI_MODEL (if set) is tried first, then the fallbacks.
  const models = [process.env.GEMINI_MODEL, ...FALLBACK_MODELS].filter(
    (m, i, arr): m is string => !!m && arr.indexOf(m) === i,
  )

  // One shared 50s limit for everything, so we fail before Vercel's 60s limit.
  const signal = AbortSignal.timeout(50_000)
  let lastError = ''

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 1.0 },
      }),
    })

    if (res.status === 404) {
      lastError = `Model ${model} not available`
      console.warn(lastError)
      continue // try the next model name
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`)
    }

    const data = await res.json()
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini returned no text')
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  }

  throw new Error(lastError || 'No Gemini model available')
}
