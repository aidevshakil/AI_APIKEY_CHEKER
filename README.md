# AI API Key Checker

Small local web app for checking whether an AI API key is valid, whether it is usable in a real project, and, when possible, estimating how many tokens are left based on remaining balance.

## What it does

- Validates a key against a provider endpoint
- Checks whether the key can list models, which is a practical sign that it can be used in an app
- Tries common balance or credit endpoints
- Can send a tiny real chat request to confirm the key works for actual model inference
- Shows whether the key is valid
- Shows remaining USD balance if the provider exposes it
- Estimates remaining tokens from the selected model price when possible

## Supported providers

- OpenAI / GPT
- Anthropic / Claude
- Google Gemini
- xAI / Grok
- DeepSeek

## Important limitation

Most AI providers do **not** expose a universal "tokens left on this API key" endpoint.

This app therefore reports:

- `Valid / Invalid` based on a real API request
- `Usable In Projects` based on whether the key can authenticate and expose model access
- `Chat Check` based on whether the provider accepts a small prompt and returns a model response
- `Remaining USD` when the provider returns usable balance data
- `Estimated Tokens Left` only when balance data exists and the selected model has a known price entry in [server.js](/Users/shakil/Downloads/Shakil/AI_APIKEY_CHEKER/server.js)

## What "usable in a project" means

For this app, a key is treated as usable when:

- the provider accepts the key, and
- the API returns at least one model from its models endpoint

That is a much better signal than just checking whether the key format looks correct.

## Run locally

```bash
npm start
```

Then open:

```text
http://localhost:3000
```
