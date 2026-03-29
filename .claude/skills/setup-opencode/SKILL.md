---
name: setup-opencode
description: Set up Open Code agent as an alternative to Claude Code. Supports OpenRouter, Gemini, and OpenAI providers. Triggers on "setup opencode", "setup open code", "use opencode", "switch to opencode".
---

# Setup Open Code Agent

Configure nagi to use Open Code instead of Claude Code. Open Code supports multiple AI providers (OpenRouter, Gemini, OpenAI).

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Step 1: Pre-flight

### Check Docker

```bash
docker info > /dev/null 2>&1 && echo "RUNNING" || echo "NOT_RUNNING"
```

If not running, start Docker first.

### Check if image exists

```bash
docker images nagi-agent-opencode --format "{{.Repository}}:{{.Tag}}" | head -1
```

If no image, it will be built in Step 5.

## Step 2: Choose Provider

AskUserQuestion: Which AI provider do you want to use?

| Provider | Best for | API Key Source |
|---|---|---|
| **OpenRouter** | Access to many models (Claude, GPT, Gemini, etc.) via one key | https://openrouter.ai/keys |
| **Google Gemini** | Google's Gemini models directly | https://aistudio.google.com/apikey |
| **OpenAI** | GPT-4o, o1, etc. | https://platform.openai.com/api-keys |

## Step 3: Get API Key

Based on the selected provider, guide the user:

### OpenRouter

AskUserQuestion: Paste your OpenRouter API key

1. Go to https://openrouter.ai/keys
2. Create a new key
3. Copy the `sk-or-...` key

### Google Gemini

AskUserQuestion: Paste your Google AI API key

1. Go to https://aistudio.google.com/apikey
2. Create API key
3. Copy the key

### OpenAI

AskUserQuestion: Paste your OpenAI API key

1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the `sk-...` key

## Step 4: Choose Model

AskUserQuestion: Which model do you want to use? (suggest defaults based on provider)

### OpenRouter defaults:
- `openrouter/anthropic/claude-sonnet-4` (Recommended)
- `openrouter/openai/gpt-4o`
- `openrouter/google/gemini-2.5-pro`

### Google Gemini defaults:
- `google/gemini-2.5-pro` (Recommended)
- `google/gemini-2.5-flash`

### OpenAI defaults:
- `openai/gpt-4o` (Recommended)
- `openai/o1`

## Step 5: Configure .env

Add/update the following in `.env`:

```bash
# Open Code settings
CONTAINER_IMAGE=nagi-agent-opencode:latest
OPENCODE_MODEL={provider}/{model}
```

And the provider-specific API key:

### OpenRouter
```
OPENROUTER_API_KEY=sk-or-...
```

### Google Gemini
```
GOOGLE_API_KEY=...
```

### OpenAI
```
OPENAI_API_KEY=sk-...
```

## Step 6: Build Docker Image

```bash
./container/build-opencode.sh
```

This builds the `nagi-agent-opencode:latest` image with Open Code CLI.

Wait for build to complete, then verify:
```bash
docker images nagi-agent-opencode --format "{{.Repository}}:{{.Tag}} {{.Size}} {{.CreatedSince}}"
```

## Step 7: Restart nagi

```bash
launchctl kickstart -k gui/$(id -u)/com.nagi
sleep 3
launchctl list | grep com.nagi
tail -5 __data/logs/nagi.log
```

## Step 8: Test

Tell user:

> Send a message in Slack/Discord. The agent should now respond using Open Code with your selected model.
>
> Check logs if no response:
> ```bash
> tail -20 __data/logs/nagi.log
> ```

## Switching back to Claude Code

To switch back, update `.env`:

```bash
CONTAINER_IMAGE=nagi-agent:latest
```

Remove or comment out the Open Code settings:
```bash
# OPENCODE_MODEL=...
# OPENROUTER_API_KEY=...
```

Then restart nagi.

## Troubleshooting

### Container fails to start
- Check Docker is running: `docker info`
- Rebuild image: `./container/build-opencode.sh`
- Check logs: `tail -20 __data/logs/nagi.error.log`

### No response from agent
- Verify API key is correct
- Check `CONTAINER_IMAGE=nagi-agent-opencode:latest` is set in `.env`
- Check `OPENCODE_MODEL` is set correctly
- Try a different model if rate limited

### Wrong model responding
- Verify `OPENCODE_MODEL` in `.env` matches your intended provider/model
- Restart nagi after changing `.env`
