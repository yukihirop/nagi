import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelOpts } from "@nagi/channel-core";
import { AsanaChannel, createAsanaFactory } from "../index.js";
import type {
  AsanaProject,
  AsanaStory,
  AsanaTask,
  AsanaTaskDetails,
  AsanaUser,
} from "../asana-client.js";

interface FakeState {
  me: AsanaUser;
  project: AsanaProject;
  tasksByProject: Map<string, AsanaTask[]>;
  storiesByTask: Map<string, AsanaStory[]>;
  taskDetailsByGid: Map<string, AsanaTaskDetails>;
  createdStories: Array<{ taskGid: string; text?: string; htmlText?: string }>;
  createdSubtasks: Array<{ parent: string; name: string }>;
  nextSubtaskGid: string;
  createStoryShouldFail?: boolean;
  createSubtaskShouldFail?: boolean;
}

function buildFakeClient(state: FakeState) {
  return {
    getUsersMe: vi.fn(async () => state.me),
    getProject: vi.fn(async () => state.project),
    getTask: vi.fn(async (taskGid: string) => {
      const existing = state.taskDetailsByGid.get(taskGid);
      if (existing) return existing;
      return {
        gid: taskGid,
        name: `task-${taskGid}`,
        modified_at: "2030-01-01T00:00:00.000Z",
        notes: "",
        parent: null,
      } satisfies AsanaTaskDetails;
    }),
    getTasksInProject: vi.fn(
      async (projectGid: string) => state.tasksByProject.get(projectGid) ?? [],
    ),
    getStoriesForTask: vi.fn(
      async (taskGid: string) => state.storiesByTask.get(taskGid) ?? [],
    ),
    createStoryOnTask: vi.fn(
      async (taskGid: string, input: { text?: string; htmlText?: string }) => {
        if (state.createStoryShouldFail) {
          throw new Error("boom");
        }
        state.createdStories.push({ taskGid, ...input });
        return {
          gid: "new-story",
          created_at: new Date().toISOString(),
          created_by: { gid: state.me.gid },
          text: input.text,
        } satisfies AsanaStory;
      },
    ),
    createSubtask: vi.fn(
      async (parent: string, input: { name: string }) => {
        if (state.createSubtaskShouldFail) {
          throw new Error("subtask-boom");
        }
        state.createdSubtasks.push({ parent, name: input.name });
        return {
          gid: state.nextSubtaskGid,
          name: input.name,
          modified_at: "2030-01-01T00:00:00.000Z",
        } satisfies AsanaTask;
      },
    ),
  };
}

function makeOpts(registered: Record<string, unknown> = {}): ChannelOpts {
  return {
    onMessage: vi.fn(),
    onChatMetadata: vi.fn(),
    registeredGroups: vi.fn(
      () => registered as ChannelOpts["registeredGroups"] extends () => infer R
        ? R
        : never,
    ),
  } as unknown as ChannelOpts;
}

const baseConfig = {
  personalAccessToken: "test-pat",
  userGid: "9999",
  projectGids: ["proj-1"],
  assistantName: "Andy",
  pollIntervalMs: 10_000,
};

function emptyState(): FakeState {
  return {
    me: { gid: "9999", name: "Me" },
    project: { gid: "proj-1", name: "Project One" },
    tasksByProject: new Map(),
    storiesByTask: new Map(),
    taskDetailsByGid: new Map(),
    createdStories: [],
    createdSubtasks: [],
    nextSubtaskGid: "subtask-1",
  };
}

describe("AsanaChannel — interface basics", () => {
  it("has name 'asana'", () => {
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => buildFakeClient(emptyState()) as never },
      makeOpts(),
    );
    expect(channel.name).toBe("asana");
  });

  it("ownsJid returns true only for asana: prefix", () => {
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => buildFakeClient(emptyState()) as never },
      makeOpts(),
    );
    expect(channel.ownsJid("asana:123")).toBe(true);
    expect(channel.ownsJid("slack:C1")).toBe(false);
    expect(channel.ownsJid("dc:1")).toBe(false);
  });

  it("isConnected false before connect, true after", async () => {
    const state = emptyState();
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => buildFakeClient(state) as never },
      makeOpts(),
    );
    expect(channel.isConnected()).toBe(false);
    await channel.connect();
    expect(channel.isConnected()).toBe(true);
    await channel.disconnect();
    expect(channel.isConnected()).toBe(false);
  });
});

describe("createAsanaFactory", () => {
  it("returns a factory that constructs AsanaChannel", () => {
    const state = emptyState();
    const factory = createAsanaFactory({
      ...baseConfig,
      clientFactory: () => buildFakeClient(state) as never,
    });
    expect(typeof factory).toBe("function");
    const channel = factory(makeOpts());
    expect(channel).not.toBeNull();
    expect(channel!.name).toBe("asana");
  });
});

describe("AsanaChannel — sendMessage", () => {
  it("posts a plain-text story to the last tracked task", async () => {
    const state = emptyState();
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      makeOpts(),
    );
    await channel.connect();

    (channel as unknown as { lastTaskGid: Map<string, string> }).lastTaskGid.set(
      "asana:proj-1",
      "task-77",
    );

    await channel.sendMessage("asana:proj-1", "hello from nagi");
    expect(fake.createStoryOnTask).toHaveBeenCalledWith("task-77", {
      text: "hello from nagi",
    });
  });

  it("drops the reply if no task has been tracked yet", async () => {
    const state = emptyState();
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      makeOpts(),
    );
    await channel.connect();

    await channel.sendMessage("asana:proj-1", "orphan reply");
    expect(fake.createStoryOnTask).not.toHaveBeenCalled();
  });

  it("does not throw when the API fails", async () => {
    const state = emptyState();
    state.createStoryShouldFail = true;
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      makeOpts(),
    );
    await channel.connect();
    (channel as unknown as { lastTaskGid: Map<string, string> }).lastTaskGid.set(
      "asana:proj-1",
      "task-77",
    );

    await expect(
      channel.sendMessage("asana:proj-1", "will fail"),
    ).resolves.toBeUndefined();
  });
});

describe("AsanaChannel — polling filters", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("creates a reply subtask on trigger and routes replies there", async () => {
    const state = emptyState();
    state.nextSubtaskGid = "subtask-77";
    state.tasksByProject.set("proj-1", [
      { gid: "task-1", name: "t1", modified_at: "2030-01-01T00:00:00.000Z" },
    ]);
    state.storiesByTask.set("task-1", [
      // plain-text trigger -> should dispatch + spawn subtask
      {
        gid: "s-trigger",
        created_at: "2030-01-01T00:00:01.000Z",
        created_by: { gid: "1234", name: "tanuki" },
        html_text: `<body>@Andy please look at this</body>`,
        resource_subtype: "comment_added",
      },
      // comment without trigger -> skip
      {
        gid: "s-plain",
        created_at: "2030-01-01T00:00:02.000Z",
        created_by: { gid: "1234" },
        html_text: `<body>just a comment without the bot name</body>`,
        resource_subtype: "comment_added",
      },
      // system story (e.g. assignment) -> skip even if the body somehow matches
      {
        gid: "s-system",
        created_at: "2030-01-01T00:00:03.000Z",
        created_by: { gid: "1234" },
        html_text: `<body>@Andy assigned this task</body>`,
        resource_subtype: "assigned",
      },
      // trigger from self -> skip (loop guard)
      {
        gid: "s-self",
        created_at: "2030-01-01T00:00:04.000Z",
        created_by: { gid: "9999" },
        html_text: `<body>@Andy replying to myself</body>`,
        resource_subtype: "comment_added",
      },
    ]);

    const opts = makeOpts({ "asana:proj-1": { name: "proj-1" } });
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      {
        ...baseConfig,
        clientFactory: () => fake as never,
        pollIntervalMs: 10_000, // clamped; first tick fires immediately
      },
      opts,
    );
    // Force the channel to consider all modified_since timestamps as "long ago"
    // so the first poll sees the tasks we set up.
    await channel.connect();
    (
      channel as unknown as { lastPollTs: Map<string, string> }
    ).lastPollTs.set("proj-1", "2000-01-01T00:00:00.000Z");

    // Trigger a poll directly rather than waiting for setTimeout.
    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    const onMessage = opts.onMessage as ReturnType<typeof vi.fn>;
    expect(onMessage).toHaveBeenCalledTimes(1);
    const [jid, message] = onMessage.mock.calls[0];
    expect(jid).toBe("asana:proj-1");
    expect(message.id).toBe("s-trigger");
    expect(message.sender).toBe("1234");
    // Content is now enriched with an <asana_task> context block, the user
    // message appears at the end.
    expect(message.content).toContain("<asana_task>");
    expect(message.content).toContain("@Andy please look at this");
    expect(message.is_from_me).toBe(false);

    // A subtask should have been created under task-1 with the body in its name.
    expect(fake.createSubtask).toHaveBeenCalledOnce();
    expect(state.createdSubtasks).toEqual([
      { parent: "task-1", name: "Andy ▸ please look at this" },
    ]);

    // A pointer comment should have been posted on the parent task as
    // html_text with a structured @mention so the sender gets notified.
    const pointer = state.createdStories.find((s) => s.taskGid === "task-1");
    expect(pointer).toBeDefined();
    expect(pointer!.htmlText).toBeDefined();
    expect(pointer!.text).toBeUndefined();
    expect(pointer!.htmlText).toContain(`<a data-asana-gid="1234">@tanuki</a>`);
    // The subtask should be rendered as a clickable task chip rather than
    // a raw URL — href + data-asana-gid + data-asana-type="task".
    expect(pointer!.htmlText).toContain(
      'href="https://app.asana.com/0/0/subtask-77"',
    );
    expect(pointer!.htmlText).toContain(
      'data-asana-gid="subtask-77"',
    );
    expect(pointer!.htmlText).toContain('data-asana-type="task"');

    // lastTaskGid should now point at the new subtask so agent replies land there.
    const lastTask = (
      channel as unknown as { lastTaskGid: Map<string, string> }
    ).lastTaskGid.get("asana:proj-1");
    expect(lastTask).toBe("subtask-77");

    // The subtask should now be in watchedSubtasks for follow-up polling.
    const watched = (
      channel as unknown as { watchedSubtasks: Map<string, Set<string>> }
    ).watchedSubtasks.get("proj-1");
    expect(watched?.has("subtask-77")).toBe(true);

    await channel.disconnect();
  });

  it("treats a trigger on an existing reply subtask as a follow-up without nesting", async () => {
    const state = emptyState();
    // No top-level tasks modified — the trigger comes from an already-tracked subtask.
    state.storiesByTask.set("subtask-77", [
      {
        gid: "s-followup",
        created_at: "2030-01-01T00:01:00.000Z",
        created_by: { gid: "1234" },
        html_text: `<body>@Andy follow up question</body>`,
        resource_subtype: "comment_added",
      },
    ]);

    const opts = makeOpts({ "asana:proj-1": { name: "proj-1" } });
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      opts,
    );
    await channel.connect();
    // Pre-seed watchedSubtasks as if an earlier turn created the subtask.
    (
      channel as unknown as { watchedSubtasks: Map<string, Set<string>> }
    ).watchedSubtasks.set("proj-1", new Set(["subtask-77"]));

    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    // Follow-up triggers should never spawn another subtask.
    expect(fake.createSubtask).not.toHaveBeenCalled();

    const onMessage = opts.onMessage as ReturnType<typeof vi.fn>;
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][1].id).toBe("s-followup");

    // lastTaskGid should still route replies to the subtask itself.
    const lastTask = (
      channel as unknown as { lastTaskGid: Map<string, string> }
    ).lastTaskGid.get("asana:proj-1");
    expect(lastTask).toBe("subtask-77");

    await channel.disconnect();
  });

  it("enriches dispatched content with an <asana_task> context block", async () => {
    const state = emptyState();
    state.tasksByProject.set("proj-1", [
      { gid: "task-42", name: "t42", modified_at: "2030-01-01T00:00:00.000Z" },
    ]);
    state.taskDetailsByGid.set("task-42", {
      gid: "task-42",
      name: "Q2 リリース計画",
      modified_at: "2030-01-01T00:00:00.000Z",
      notes: "Q2 リリースに向けた準備タスク。\n要: デプロイ手順確定",
      parent: null,
    });
    state.storiesByTask.set("task-42", [
      // Older comment from another user (included as history)
      {
        gid: "s-old",
        created_at: "2030-01-01T00:00:01.000Z",
        created_by: { gid: "1234", name: "tanuki" },
        html_text: `<body>背景の共有です</body>`,
        resource_subtype: "comment_added",
      },
      // The triggering comment
      {
        gid: "s-trigger",
        created_at: "2099-12-31T23:59:59.000Z",
        created_by: { gid: "1234", name: "tanuki" },
        html_text: `<body>@Andy 次の手順を教えて</body>`,
        resource_subtype: "comment_added",
      },
    ]);

    const opts = makeOpts({ "asana:proj-1": { name: "proj-1" } });
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      opts,
    );
    await channel.connect();
    (
      channel as unknown as { lastPollTs: Map<string, string> }
    ).lastPollTs.set("proj-1", "2000-01-01T00:00:00.000Z");

    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    const onMessage = opts.onMessage as ReturnType<typeof vi.fn>;
    expect(onMessage).toHaveBeenCalledTimes(1);
    const content: string = onMessage.mock.calls[0][1].content;

    // Task name + description + history all appear in the context block.
    expect(content).toContain("<asana_task>");
    expect(content).toContain("name: Q2 リリース計画");
    expect(content).toContain("Q2 リリースに向けた準備タスク");
    expect(content).toContain("要: デプロイ手順確定");
    expect(content).toContain("comments:");
    expect(content).toContain("tanuki: 背景の共有です");
    // And the actual user message is still at the end.
    expect(content).toContain("@Andy 次の手順を教えて");
    // User message must come first so MessageLoop's /^@ai\b/ trigger check
    // still matches after context injection.
    expect(content.indexOf("@Andy 次の手順を教えて")).toBeLessThan(
      content.indexOf("<asana_task>"),
    );
    // Trigger-pattern sanity: the start of the content satisfies the agent
    // trigger used by nagi's MessageLoop.
    expect(/^@Andy\b/i.test(content)).toBe(true);
    // getTask should have been called for the triggering task.
    expect(fake.getTask).toHaveBeenCalledWith("task-42");

    await channel.disconnect();
  });

  it("dispatches without context when getTask fails", async () => {
    const state = emptyState();
    state.tasksByProject.set("proj-1", [
      { gid: "task-1", name: "t1", modified_at: "2030-01-01T00:00:00.000Z" },
    ]);
    state.storiesByTask.set("task-1", [
      {
        gid: "s-trigger",
        created_at: "2099-12-31T23:59:59.000Z",
        created_by: { gid: "1234" },
        html_text: `<body>@Andy hi</body>`,
        resource_subtype: "comment_added",
      },
    ]);

    const opts = makeOpts({ "asana:proj-1": { name: "proj-1" } });
    const fake = buildFakeClient(state);
    fake.getTask = vi.fn(async () => {
      throw new Error("500");
    });
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      opts,
    );
    await channel.connect();
    (
      channel as unknown as { lastPollTs: Map<string, string> }
    ).lastPollTs.set("proj-1", "2000-01-01T00:00:00.000Z");

    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    const onMessage = opts.onMessage as ReturnType<typeof vi.fn>;
    expect(onMessage).toHaveBeenCalledTimes(1);
    const content: string = onMessage.mock.calls[0][1].content;
    // Falls back to plain content without the context header.
    expect(content).not.toContain("<asana_task>");
    expect(content).toContain("@Andy hi");

    await channel.disconnect();
  });

  it("ignores stories posted before the channel connected", async () => {
    const state = emptyState();
    state.tasksByProject.set("proj-1", [
      { gid: "task-1", name: "t1", modified_at: "2030-01-01T00:00:00.000Z" },
    ]);
    // Two triggers on the same task — one from "last year", one "now".
    // Only the second one should dispatch after a fresh connect().
    state.storiesByTask.set("task-1", [
      {
        gid: "s-ancient",
        created_at: "2000-01-01T00:00:00.000Z",
        created_by: { gid: "1234" },
        html_text: `<body>@Andy long ago</body>`,
        resource_subtype: "comment_added",
      },
      {
        gid: "s-fresh",
        created_at: "2099-12-31T23:59:59.000Z",
        created_by: { gid: "1234" },
        html_text: `<body>@Andy recent</body>`,
        resource_subtype: "comment_added",
      },
    ]);

    const opts = makeOpts({ "asana:proj-1": { name: "proj-1" } });
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      opts,
    );
    await channel.connect();
    // Force a wide project-level fetch; story-level cursor should still cut off.
    (
      channel as unknown as { lastPollTs: Map<string, string> }
    ).lastPollTs.set("proj-1", "2000-01-01T00:00:00.000Z");

    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    const onMessage = opts.onMessage as ReturnType<typeof vi.fn>;
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0][1].id).toBe("s-fresh");
    // Ensure exactly one subtask was spawned (not two).
    expect(fake.createSubtask).toHaveBeenCalledTimes(1);

    await channel.disconnect();
  });

  it("falls back to replying on the parent task when subtask creation fails", async () => {
    const state = emptyState();
    state.createSubtaskShouldFail = true;
    state.tasksByProject.set("proj-1", [
      { gid: "task-1", name: "t1", modified_at: "2030-01-01T00:00:00.000Z" },
    ]);
    state.storiesByTask.set("task-1", [
      {
        gid: "s-trigger",
        created_at: "2030-01-01T00:00:01.000Z",
        created_by: { gid: "1234" },
        html_text: `<body>@Andy emergency</body>`,
        resource_subtype: "comment_added",
      },
    ]);

    const opts = makeOpts({ "asana:proj-1": { name: "proj-1" } });
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      opts,
    );
    await channel.connect();
    (
      channel as unknown as { lastPollTs: Map<string, string> }
    ).lastPollTs.set("proj-1", "2000-01-01T00:00:00.000Z");

    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    // Dispatch still happens despite the subtask API failure.
    const onMessage = opts.onMessage as ReturnType<typeof vi.fn>;
    expect(onMessage).toHaveBeenCalledTimes(1);

    // lastTaskGid should point at the parent since the subtask never materialized.
    const lastTask = (
      channel as unknown as { lastTaskGid: Map<string, string> }
    ).lastTaskGid.get("asana:proj-1");
    expect(lastTask).toBe("task-1");

    // No parent-pointer comment should have been posted either (we only do that
    // after successfully creating the subtask).
    expect(state.createdStories).toEqual([]);

    await channel.disconnect();
  });

  it("skips dispatch for unregistered projects and never spawns a subtask", async () => {
    const state = emptyState();
    state.tasksByProject.set("proj-1", [
      { gid: "task-1", name: "t1", modified_at: "2030-01-01T00:00:00.000Z" },
    ]);
    state.storiesByTask.set("task-1", [
      {
        gid: "s-trigger",
        created_at: "2030-01-01T00:00:01.000Z",
        created_by: { gid: "1234" },
        html_text: `<body>@Andy take a look</body>`,
        resource_subtype: "comment_added",
      },
    ]);

    // Note: no registered groups.
    const opts = makeOpts({});
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      opts,
    );
    await channel.connect();
    (
      channel as unknown as { lastPollTs: Map<string, string> }
    ).lastPollTs.set("proj-1", "2000-01-01T00:00:00.000Z");

    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    // Metadata is still broadcast so group discovery works.
    expect(opts.onChatMetadata).toHaveBeenCalled();
    // But no message dispatch and no subtask pollution.
    expect(opts.onMessage).not.toHaveBeenCalled();
    expect(fake.createSubtask).not.toHaveBeenCalled();

    await channel.disconnect();
  });

  it("fetches userGid from /users/me when not preconfigured", async () => {
    const state = emptyState();
    state.me = { gid: "fetched-9999", name: "Me" };
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      {
        ...baseConfig,
        userGid: undefined,
        clientFactory: () => fake as never,
      },
      makeOpts(),
    );
    await channel.connect();

    expect(fake.getUsersMe).toHaveBeenCalled();
    expect(channel.isConnected()).toBe(true);
    await channel.disconnect();
  });
});

describe("AsanaChannel — poll state persistence", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "asana-state-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves state after pollProject", async () => {
    const state = emptyState();
    state.tasksByProject.set("proj-1", []);
    const fake = buildFakeClient(state);
    const opts = makeOpts({ "asana:proj-1": { folder: "main", channel: "asana" } });
    const channel = new AsanaChannel(
      { ...baseConfig, stateDir: tmpDir, clientFactory: () => fake as never },
      opts,
    );
    await channel.connect();
    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    const stateFile = path.join(tmpDir, "asana-poll-state.json");
    expect(fs.existsSync(stateFile)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    expect(saved.lastPollTs).toHaveProperty("proj-1");
    expect(typeof saved.connectedAt).toBe("string");

    await channel.disconnect();
  });

  it("restores state on connect including lastStoryTs", async () => {
    const savedTs = "2026-01-01T00:00:00.000Z";
    const storyTs = "2026-01-01T00:05:00.000Z";
    fs.writeFileSync(
      path.join(tmpDir, "asana-poll-state.json"),
      JSON.stringify({
        lastPollTs: { "proj-1": savedTs },
        connectedAt: "2025-12-31T00:00:00.000Z",
        lastStoryTs: { "task-42": storyTs },
      }),
    );

    const state = emptyState();
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      { ...baseConfig, stateDir: tmpDir, clientFactory: () => fake as never },
      makeOpts(),
    );
    await channel.connect();

    const lastPollTs = (channel as unknown as { lastPollTs: Map<string, string> }).lastPollTs;
    expect(lastPollTs.get("proj-1")).toBe(savedTs);

    const lastStoryTs = (channel as unknown as { lastStoryTs: Map<string, string> }).lastStoryTs;
    expect(lastStoryTs.get("task-42")).toBe(storyTs);

    const connectedAt = (channel as unknown as { connectedAt: string }).connectedAt;
    expect(connectedAt).toBe(savedTs);

    await channel.disconnect();
  });

  it("sets connectedAt to min of restored lastPollTs", async () => {
    const earlier = "2026-01-01T00:00:00.000Z";
    const later = "2026-01-02T00:00:00.000Z";
    fs.writeFileSync(
      path.join(tmpDir, "asana-poll-state.json"),
      JSON.stringify({
        lastPollTs: { "proj-1": later, "proj-2": earlier },
        connectedAt: "2025-12-31T00:00:00.000Z",
      }),
    );

    const state = emptyState();
    const fake = buildFakeClient(state);
    const channel = new AsanaChannel(
      {
        ...baseConfig,
        projectGids: ["proj-1", "proj-2"],
        stateDir: tmpDir,
        clientFactory: () => fake as never,
      },
      makeOpts(),
    );
    await channel.connect();

    const connectedAt = (channel as unknown as { connectedAt: string }).connectedAt;
    expect(connectedAt).toBe(earlier);

    await channel.disconnect();
  });

  it("falls back to now when state file is missing", async () => {
    const state = emptyState();
    const fake = buildFakeClient(state);
    const before = new Date().toISOString();
    const channel = new AsanaChannel(
      { ...baseConfig, stateDir: tmpDir, clientFactory: () => fake as never },
      makeOpts(),
    );
    await channel.connect();

    const connectedAt = (channel as unknown as { connectedAt: string }).connectedAt;
    expect(connectedAt >= before).toBe(true);

    await channel.disconnect();
  });

  it("falls back to now when state file is corrupt", async () => {
    fs.writeFileSync(path.join(tmpDir, "asana-poll-state.json"), "not-json{{{");

    const state = emptyState();
    const fake = buildFakeClient(state);
    const before = new Date().toISOString();
    const channel = new AsanaChannel(
      { ...baseConfig, stateDir: tmpDir, clientFactory: () => fake as never },
      makeOpts(),
    );
    await channel.connect();

    const connectedAt = (channel as unknown as { connectedAt: string }).connectedAt;
    expect(connectedAt >= before).toBe(true);

    await channel.disconnect();
  });

  it("does not write state when stateDir is undefined", async () => {
    const state = emptyState();
    state.tasksByProject.set("proj-1", []);
    const fake = buildFakeClient(state);
    const opts = makeOpts({ "asana:proj-1": { folder: "main", channel: "asana" } });
    const channel = new AsanaChannel(
      { ...baseConfig, clientFactory: () => fake as never },
      opts,
    );
    await channel.connect();
    await (channel as unknown as { pollOnce: () => Promise<void> }).pollOnce();

    // No state file should be created anywhere
    const stateFile = path.join(tmpDir, "asana-poll-state.json");
    expect(fs.existsSync(stateFile)).toBe(false);

    await channel.disconnect();
  });
});

// --- helpers (see top of file for emptyState) -----------------------------
