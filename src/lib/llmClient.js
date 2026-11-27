// Provider request formatting only. Rotation and error policy live in llmRotator.js.

// Never send a BYOK secret to an arbitrary cleartext endpoint. Local Ollama is
// the one legitimate exception.
export function safeEndpoint(raw, provider) {
  let url
  try {
    url = new URL(String(raw ?? '').trim())
  } catch {
    throw new Error('Enter a full service address, e.g. https://api.example.com/v1')
  }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase())
  if (url.protocol !== 'https:' && !(provider === 'ollama' && local)) {
    throw new Error('Service address must use HTTPS. Only a local Ollama address may use HTTP.')
  }
  return url.href.replace(/\/+$/, '')
}

export async function requestText(key, { prompt, systemPrompt = '', model, signal }) {
  const baseUrl = safeEndpoint(key.baseUrl, key.provider)

  if (key.provider === 'gemini') {
    const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key.apiKey)}`
    const response = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }),
    })
    const text = await response.text()
    if (!response.ok) return { status: response.status, text, headers: response.headers }
    const data = JSON.parse(text)
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''
    return { status: response.status, text: content, headers: response.headers }
  }

  if (key.provider === 'groq' || key.provider === 'openrouter' || key.provider === 'ollama') {
    const endpoint = key.provider === 'ollama' && !baseUrl.endsWith('/v1') ? `${baseUrl}/v1` : baseUrl
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(key.provider === 'ollama' ? {} : { Authorization: `Bearer ${key.apiKey}` }),
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        ...(key.provider === 'groq' ? { response_format: { type: 'json_object' } } : {}),
        temperature: 0.3,
      }),
    })
    const text = await response.text()
    if (!response.ok) return { status: response.status, text, headers: response.headers }
    const data = JSON.parse(text)
    return {
      status: response.status,
      text: data.choices?.[0]?.message?.content ?? '',
      headers: response.headers,
    }
  }

  return { status: 400, text: `Unsupported provider: ${key.provider}`, headers: new Headers() }
}

// Safe JSON parse that tolerates markdown fences around model output.
export function parseJsonResponse(text) {
  const cleaned = String(text ?? '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  return JSON.parse(cleaned)
}
