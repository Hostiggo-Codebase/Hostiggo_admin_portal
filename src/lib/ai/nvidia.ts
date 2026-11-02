import { readFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const DEFAULT_MODEL = 'nvidia/nemotron-3.5-bolt-e4b'

/** Reads a server-side NVIDIA key; never import this module into client code. */
export async function getNvidiaApiKey(): Promise<string | null> {
  if (process.env.NVIDIA_API_KEY?.trim()) return process.env.NVIDIA_API_KEY.trim()

  const keyFile = process.env.NVIDIA_API_KEY_FILE || path.join(process.cwd(), '.secrets/nvidia-api-key.txt')
  try {
    const contents = await readFile(keyFile, 'utf8')
    const key = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'))
    return key || null
  } catch {
    return null
  }
}

/** OpenAI-compatible NVIDIA NIM chat completions client using native fetch. */
export async function nvidiaChatCompletion(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  options: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  const apiKey = await getNvidiaApiKey()
  if (!apiKey) throw new Error('NVIDIA API key is not configured')

  const baseUrl = (process.env.NVIDIA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.NVIDIA_MODEL || DEFAULT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 80,
      temperature: 0.2,
      stream: false,
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`NVIDIA API returned HTTP ${response.status}`)
  }

  const result = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = result.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error('NVIDIA API returned an empty response')
  return content
}
