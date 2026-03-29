---
name: create-plugin-channel
description: Scaffold a new channel plugin for nagi. Generates package with Channel interface implementation, factory function, tests, and apps/entry.template.ts registration. Triggers on "create channel plugin", "new channel", "scaffold channel", "add channel plugin".
---

# Create Channel Plugin

Scaffold a new channel plugin that connects nagi to a messaging platform, following the established pattern (channel-slack, channel-discord).

**UX Note:** Use `AskUserQuestion` for all user-facing questions.

## Step 1: Gather information

AskUserQuestion:
1. Channel name (lowercase — e.g., "telegram", "whatsapp", "line")
2. One-line description (e.g., "Telegram bot channel via grammy library")
3. What SDK/library does this channel use? (e.g., "grammy", "whatsapp-web.js")
4. What credentials are needed? (e.g., "BOT_TOKEN" → env var `TELEGRAM_BOT_TOKEN`)
5. JID prefix for this channel (e.g., "tg:" for Telegram, "wa:" for WhatsApp)

## Step 2: Generate package

Create `apps/plugins/channel-{name}/` with the following structure:

### package.json

```json
{
  "name": "@nagi/channel-{name}",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@nagi/channel-core": "workspace:*",
    "@nagi/types": "workspace:*",
    "@nagi/logger": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.1.4"
  }
}
```

Add the channel's SDK library to dependencies (e.g., `"grammy": "^1.x"`).

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts"],
  },
});
```

### src/{name}-channel.ts

Generate a Channel implementation. Follow this pattern:

```typescript
import type { Channel, ChannelOpts, ChannelFactory } from "@nagi/channel-core";
import { createLogger } from "@nagi/logger";

const logger = createLogger({ name: "channel-{name}" });

export interface {Name}ChannelConfig {
  botToken: string;
  assistantName?: string;
  triggerPattern?: RegExp;
  // Add channel-specific config fields
}

export class {Name}Channel implements Channel {
  name = "{name}";

  private config: {
    assistantName: string;
    triggerPattern: RegExp;
  };
  private connected = false;
  private opts: ChannelOpts;

  constructor(config: {Name}ChannelConfig, opts: ChannelOpts) {
    const assistantName = config.assistantName ?? "Andy";
    this.config = {
      assistantName,
      triggerPattern:
        config.triggerPattern ?? new RegExp(`^@${assistantName}\\b`, "i"),
    };
    this.opts = opts;

    // TODO: Initialize SDK client here
  }

  async connect(): Promise<void> {
    // TODO: Connect to platform, set up message handlers
    // In message handler:
    //   - Call this.opts.onChatMetadata() for all messages (group discovery)
    //   - Call this.opts.onMessage() only for registered groups
    //   - Translate bot mentions to trigger pattern format
    this.connected = true;
    logger.info("Connected to {Name}");
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    // TODO: Extract channel ID from JID, send message
    // Never throw — log errors and return
    logger.info({ jid, length: text.length }, "{Name} message sent");
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith("{prefix}:");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    // TODO: Disconnect from platform
    logger.info("{Name} bot stopped");
  }

  async setTyping(_jid: string, _isTyping: boolean): Promise<void> {
    // TODO: Send typing indicator if platform supports it
    // No-op if not supported
  }

  async syncGroups(_force: boolean): Promise<void> {
    // TODO: Sync channel/group metadata if platform supports it
    // Call this.opts.onChatMetadata() for each discovered group
  }
}

export function create{Name}Factory(
  config: {Name}ChannelConfig,
): ChannelFactory {
  return (opts: ChannelOpts) => new {Name}Channel(config, opts);
}
```

Replace `{name}`, `{Name}`, `{prefix}` placeholders.

### src/index.ts

```typescript
export { {Name}Channel, create{Name}Factory } from "./{name}-channel.js";
export type { {Name}ChannelConfig } from "./{name}-channel.js";
```

### src/__tests__/{name}-channel.test.ts

Generate basic tests:

```typescript
import { describe, expect, it, vi } from "vitest";
import { {Name}Channel, create{Name}Factory } from "../index.js";
import type { ChannelOpts } from "@nagi/channel-core";

const mockOpts: ChannelOpts = {
  onMessage: vi.fn(),
  onChatMetadata: vi.fn(),
  registeredGroups: () => ({}),
};

const baseConfig = {
  botToken: "test-token",
};

describe("{Name}Channel", () => {
  it("has name '{name}'", () => {
    const channel = new {Name}Channel(baseConfig, mockOpts);
    expect(channel.name).toBe("{name}");
  });

  it("ownsJid returns true for {prefix}: prefix", () => {
    const channel = new {Name}Channel(baseConfig, mockOpts);
    expect(channel.ownsJid("{prefix}:123")).toBe(true);
  });

  it("ownsJid returns false for other prefixes", () => {
    const channel = new {Name}Channel(baseConfig, mockOpts);
    expect(channel.ownsJid("slack:123")).toBe(false);
  });

  it("isConnected returns false before connect", () => {
    const channel = new {Name}Channel(baseConfig, mockOpts);
    expect(channel.isConnected()).toBe(false);
  });
});

describe("create{Name}Factory", () => {
  it("returns a factory function", () => {
    const factory = create{Name}Factory(baseConfig);
    expect(typeof factory).toBe("function");
  });

  it("factory creates a {Name}Channel instance", () => {
    const factory = create{Name}Factory(baseConfig);
    const channel = factory(mockOpts);
    expect(channel).not.toBeNull();
    expect(channel!.name).toBe("{name}");
  });
});
```

## Step 3: Add to root package.json

Add the new package to root `package.json` dependencies for type resolution:

```json
"@nagi/channel-{name}": "workspace:*"
```

## Step 4: Add to apps/entry.template.ts

Add a registration block to `apps/entry.template.ts`:

```typescript
// Register {Name} if configured
const {name}Env = readEnvFile(["{ENV_VARS}"]);
if ({name}Env.{PRIMARY_ENV_VAR}) {
  const { create{Name}Factory } = await import("@nagi/channel-{name}");
  registry.register(
    "{name}",
    create{Name}Factory({
      botToken: {name}Env.{PRIMARY_ENV_VAR},
      assistantName: config.assistantName,
      triggerPattern: config.triggerPattern,
    }),
  );
  logger.info("{Name} channel registered");
}
```

## Step 5: Build & verify

```bash
pnpm install
pnpm build
pnpm --filter @nagi/channel-{name} test
```

All packages must build and tests must pass.

## Step 6: Next steps

Tell the user:

1. **Implement the Channel interface** — Edit `apps/plugins/channel-{name}/src/{name}-channel.ts`:
   - `connect()` — Set up SDK client, register message handlers
   - `sendMessage()` — Send text to a JID
   - `setTyping()` — Typing indicator (no-op if unsupported)
   - `syncGroups()` — Group metadata discovery (optional)
2. **Add SDK dependency** — `pnpm --filter @nagi/channel-{name} add {sdk-package}`
3. **Sync entry.ts** — Run `/update-entry`
4. **Add credentials** — Add token to `.env`
5. **Test** — `pnpm --filter @nagi/channel-{name} test`
6. **Restart** — Run `/nagi-restart`

## Key design rules

- **JID format:** `{prefix}:{platformId}` — must be unique across all channels
- **ownsJid:** Must match the JID prefix exactly
- **sendMessage:** Must **never throw** — log errors and return
- **onMessage:** Only call for registered groups (`opts.registeredGroups()[jid]`)
- **onChatMetadata:** Call for ALL messages (enables group discovery)
- **Mention translation:** Convert platform-specific mentions (e.g., `<@BOT_ID>`) to trigger pattern format (`@AssistantName`)

## Reference

Existing channel plugins to study:
- `apps/plugins/channel-slack/` — Socket Mode, thread replies, message queueing, user name cache
- `apps/plugins/channel-discord/` — Gateway intents, thread creation, attachment handling, 2000-char splitting
