---
name: create-group-prompt
description: Create prompt files (IDENTITY.md, SOUL.md, INSTRUCTIONS.md etc.) in deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/. Writes directly to the user-editable default layer (skipping templates). Interactive setup for agent personality and behavior. Triggers on "create group prompt", "add group prompt", "create prompt", "add identity", "add soul".
---

# Create Group Prompt Files

Create additional prompt files for a group. These files are automatically loaded into the agent's systemPrompt at session start (via agent-runner-claudecode).

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Step 1: Select channel and group

First, list available groups:

```bash
find deploy/{ASSISTANT_NAME}/groups/ -type d -mindepth 2 -maxdepth 2 | sort
```

AskUserQuestion: Which channel and group?

Show the existing groups as options, e.g.:
- `slack/main`
- `discord/main`
- Other (specify channel and group name)

If the user picks "Other", ask for the channel name and group name separately.

## Step 2: Check existing prompt files

List what's already in the selected group directory:

```bash
ls -la deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/
```

Show the user what files already exist. Explain that `CLAUDE.md` is loaded by the SDK automatically, and any other `*.md` files are loaded into systemPrompt.append.

## Step 3: Choose which files to create

AskUserQuestion: Which prompt files do you want to create?

Present these common options (multi-select):
- **IDENTITY.md** — Agent personality, name, speech style, language
- **SOUL.md** — Mission, core values, behavioral principles
- **INSTRUCTIONS.md** — Tool usage rules, security rules, structured output specs
- **AGENTS.md** — Available tools inventory and usage guidelines
- **Custom** — Specify a custom filename (must end in .md)

Skip any files that already exist (inform the user). If the user wants to overwrite, confirm first.

## Step 4: Gather content for each file

For each selected file, ask the user what to include:

### IDENTITY.md

AskUserQuestion: Tell me about the agent's identity:
- Name / nickname
- Character / personality (e.g., "zundamon-style character", professional assistant, casual helper)
- Speech style (e.g., ends sentences with "〜のだ" / "〜なのだ", polite speech, casual tone)
- Language preference (Japanese, English, auto-detect)

Generate the file with the user's input structured as markdown sections.

**Default example (if user has no preference):**

```markdown
# Identity

## Name
なぎ (Nagi)

## Character
A cheerful zundamon-style assistant who loves helping with tasks.

## Speech Style
- Ends sentences with "〜のだ" or "〜なのだ"
- Energetic and friendly tone
- Example: "タスクが完了したのだ！" "調べてみるのだ！"

## Language
- Auto-detect from user's message
- Default: Japanese
```

### SOUL.md

AskUserQuestion: What is the agent's mission and values?
- Primary mission (e.g., "support daily work with tools", "help with coding tasks")
- Core values (e.g., safety, friendliness, autonomy, accuracy)
- Behavioral principles (e.g., ask for clarification when unclear, report failures honestly)

### INSTRUCTIONS.md

AskUserQuestion: What rules should the agent follow?
- Security rules (e.g., never output secrets, never delete files outside workspace)
- Tool usage rules (e.g., prefer MCP tools over Bash for browser operations)
- Output format rules (e.g., structured output blocks, response length limits)

### AGENTS.md

AskUserQuestion: What tools/skills does the agent have access to?
- MCP tools categories
- Built-in tools
- Custom skills
- Usage rules per tool

### Custom files

AskUserQuestion: What is the purpose of this file and what should it contain?

## Step 5: Write the files

For each file, write to `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/{filename}`:

```
# {Title}

{Generated content based on user input}
```

Show the user each file's content before writing, and confirm.

## Step 6: Sync to runtime

Ask the user if they want to sync now:

AskUserQuestion: Sync to runtime now?
- **Yes** — Run the update-groups sync process
- **No** — User will sync manually later

If yes, for each new file:
```bash
mkdir -p "__data/{ASSISTANT_NAME}/groups/{channel}/{group}"
cp "deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/{filename}" "__data/{ASSISTANT_NAME}/groups/{channel}/{group}/{filename}"
```

## Step 7: Summary

Report:
- Files created and their paths
- Remind that changes take effect on next container launch
- Suggest running `/nagi-restart` if nagi is currently running
- Explain load order: files are sorted alphabetically (AGENTS.md → IDENTITY.md → INSTRUCTIONS.md → SOUL.md)
