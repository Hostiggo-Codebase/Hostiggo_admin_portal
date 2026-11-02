# NVIDIA model setup

The NVIDIA API key is read only by server-side code. It is never exposed to the browser.

## Local development

1. Create an NVIDIA API key in the NVIDIA API Catalog.
2. Paste the key as the only non-comment line in `.secrets/nvidia-api-key.txt`.
3. Keep the file local; `.secrets/` is ignored by Git.
4. Optionally set `NVIDIA_MODEL` and `NVIDIA_BASE_URL` in `.env.local`.

Defaults:

- Model: `nvidia/nemotron-3.5-bolt-e4b`
- API base: `https://integrate.api.nvidia.com/v1`

The server helper is `src/lib/ai/nvidia.ts`. It accepts an optional `NVIDIA_API_KEY_FILE` path and falls back to the ignored local key file when `NVIDIA_API_KEY` is unset.

## Vercel deployment

Vercel cannot read a file from a developer's computer. Add `NVIDIA_API_KEY` as a server-side environment variable in Vercel Project Settings, then redeploy. Do not use a `NEXT_PUBLIC_` prefix.

The helper uses the OpenAI-compatible NVIDIA NIM `/chat/completions` endpoint. Ticket-title generation can call it server-side and retain the customer-name title if the key or model is unavailable.
