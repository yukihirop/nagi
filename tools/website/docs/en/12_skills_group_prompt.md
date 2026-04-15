# Group Prompt Skills

Skills for creating and editing the prompt files that shape agent behavior. These files live under `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/` and are loaded into the agent's system prompt at session start.

## Prompt file hierarchy {#file-hierarchy}

Each group directory can contain several Markdown files. They are loaded differently depending on their name:

| File | Loaded by | Purpose |
|------|-----------|---------|
| `CLAUDE.md` | Claude Code SDK (automatic) | Main instructions the SDK injects before any other prompt content. |
| `AGENTS.md` | Open Code runner only | Tool inventory and usage guidelines. Ignored by the Claude Code runner to avoid conflicting persona instructions. |
| `IDENTITY.md` | Agent runner (`systemPrompt.append`) | Agent name, character, speech style, language preference. |
| `SOUL.md` | Agent runner (`systemPrompt.append`) | Mission statement, core values, behavioral principles. |
| `INSTRUCTIONS.md` | Agent runner (`systemPrompt.append`) | Security rules, tool usage rules, output format constraints. |
| `*.md` (custom) | Agent runner (`systemPrompt.append`) | Any additional Markdown file you create is also loaded. |

### How files are loaded

The Claude Code agent runner scans the group directory at session start and collects every `*.md` file **except** `CLAUDE.md` and `AGENTS.md`. Those collected files are sorted alphabetically and concatenated into a single string that is appended to the system prompt via the `systemPrompt.append` field.

Because files are sorted alphabetically, the effective load order for the standard set is:

```
IDENTITY.md -> INSTRUCTIONS.md -> SOUL.md -> (any custom files)
```

`CLAUDE.md` is handled separately by the Claude Code SDK itself and is always loaded regardless of other files.

### Directory layout example

```
deploy/{ASSISTANT_NAME}/groups/
  slack/
    main/
      CLAUDE.md          # SDK auto-loaded
      IDENTITY.md        # -> systemPrompt.append
      SOUL.md            # -> systemPrompt.append
      INSTRUCTIONS.md    # -> systemPrompt.append
  discord/
    main/
      CLAUDE.md
      AGENTS.md          # Open Code only
```

### Template vs. deploy layers

Nagi maintains two layers of prompt files:

- **`deploy/templates/groups/`** -- The pristine upstream baseline. Do not edit these directly; they are overwritten during upgrades.
- **`deploy/{ASSISTANT_NAME}/groups/`** -- Your editable copies. The skills below always read from and write to this layer.

After editing, files are synced to the runtime directory (`__data/{ASSISTANT_NAME}/groups/`) so the running agent picks them up.

## Best practices for writing prompt files {#best-practices}

- **Keep files focused.** Put identity traits in `IDENTITY.md`, values in `SOUL.md`, and rules in `INSTRUCTIONS.md`. This makes it easy to update one aspect without touching the others.
- **Use clear Markdown structure.** Headings, bullet lists, and short paragraphs are easier for the model to follow than long prose.
- **Be specific over vague.** "End every sentence with `~noda`" is better than "speak in a cute way."
- **Avoid contradictions across files.** Since all files are concatenated, conflicting instructions in different files can confuse the agent. Review the full set when adding new rules.
- **Keep total size reasonable.** All prompt files share the context window with the user's conversation. Aim for concise instructions rather than exhaustive documentation.
- **Test after editing.** Use `/nagi-restart` (or wait for the next container launch) to verify the agent behaves as expected.

---

## `/create-group-prompt` — Create Prompt {#create-group-prompt}

Interactively create new prompt files under `deploy/{ASSISTANT_NAME}/groups/{channel}/{group}/`.

**Triggers:** `create group prompt`, `add group prompt`, `create prompt`, `add identity`, `add soul`

### Workflow

1. **Select channel and group** -- Lists existing groups (e.g., `slack/main`, `discord/main`) and lets you pick one or specify a new one.
2. **Check existing files** -- Shows which prompt files already exist in the selected directory so you can avoid duplicates.
3. **Choose files to create** -- Multi-select from `IDENTITY.md`, `SOUL.md`, `INSTRUCTIONS.md`, `AGENTS.md`, or a custom filename.
4. **Define content** -- For each selected file, the skill asks targeted questions (name, personality, speech style, mission, rules, etc.) and generates structured Markdown.
5. **Write files** -- Previews each file's content and writes it after confirmation.
6. **Sync to runtime** -- Optionally copies the new files to `__data/{ASSISTANT_NAME}/groups/` so they take effect immediately.

### Available file types

| File | What the skill asks |
|------|---------------------|
| `IDENTITY.md` | Name, character/personality, speech style, language preference |
| `SOUL.md` | Primary mission, core values, behavioral principles |
| `INSTRUCTIONS.md` | Security rules, tool usage rules, output format rules |
| `AGENTS.md` | MCP tools, built-in tools, custom skills, per-tool usage rules |
| Custom `*.md` | Purpose and content (free-form) |

---

## `/update-group-prompt` — Edit Prompt {#update-group-prompt}

Interactively edit an existing group prompt file. Previews every change as a unified diff before saving.

**Triggers:** `update group prompt`, `edit group prompt`, `modify claude.md`, `edit identity`, `update soul`, `update instructions`

### Workflow

1. **Select group** -- Lists groups under `deploy/{ASSISTANT_NAME}/groups/` and asks which one to edit.
2. **Select file** -- Lists Markdown files in the chosen group directory.
3. **Choose edit mode**:
   - **Natural language instruction** (recommended) -- Describe the change in plain text (e.g., "make the tone more casual", "add a rule to never output API keys") and the skill applies it.
   - **Append** -- Add new content to the end of the file.
4. **Preview diff** -- A unified diff of the proposed change is shown. You can approve, view the full file, redo, or cancel.
5. **Write** -- The edit is applied via the `Edit` tool. If it fails, the skill reports the error and offers to retry.
6. **Sync to runtime** -- Optionally copies the updated file to `__data/{ASSISTANT_NAME}/groups/`.
7. **Restart** -- If the agent is running under launchd, offers to restart so changes take effect immediately.

### Rules the skill enforces

- Always previews a diff before saving -- no silent writes.
- Edits `deploy/{ASSISTANT_NAME}/groups/` only, never `deploy/templates/groups/` or `__data/` directly.
- One file per invocation. Run the skill again to edit another file.
- Fails loudly on errors instead of silently proceeding.
