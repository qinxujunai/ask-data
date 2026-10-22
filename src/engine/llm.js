// An OpenAI-compatible chat call (DeepSeek by default), JSON mode, with a timeout.
// In the browser the key goes straight from the reader's browser to the model provider.

export const DEFAULT_MODEL = { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' };

export function createLLM({ key, baseUrl = DEFAULT_MODEL.baseUrl, model = DEFAULT_MODEL.model, fetchImpl = globalThis.fetch, timeoutMs = 60000 } = {}) {
  if (!key) return null;
  return async function chat(messages) {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const hint = res.status === 401 ? 'key 不对' : res.status === 402 ? '余额不足' : res.status === 429 ? '请求太频繁' : `HTTP ${res.status}`;
      throw new Error(`模型服务返回错误：${hint}`);
    }
    const data = await res.json();
    return parseJSON(data.choices?.[0]?.message?.content);
  };
}

export function parseJSON(text) {
  const s = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('模型没有返回 JSON');
  }
}
