import { createLogger } from "@nagi/logger";

const logger = createLogger({ name: "channel-asana:client" });

const ASANA_API_BASE = "https://app.asana.com/api/1.0";
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;

export interface AsanaUser {
  gid: string;
  name?: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  modified_at: string;
}

export interface AsanaTaskDetails extends AsanaTask {
  notes?: string;
  parent?: {
    gid: string;
    name: string;
    notes?: string;
  } | null;
}

export interface AsanaStory {
  gid: string;
  created_at: string;
  created_by: { gid: string; name?: string } | null;
  html_text?: string;
  text?: string;
  resource_subtype?: string;
  type?: string;
}

export interface AsanaClientOptions {
  personalAccessToken: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Thin wrapper over Asana REST API.
 *
 * Scope is limited to what the channel needs:
 * - Identify the authenticated user
 * - List projects/tasks for polling
 * - Read stories on a task
 * - Create comment stories
 *
 * Never throws on transport/rate-limit failures unless retries are exhausted.
 */
export class AsanaClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AsanaClientOptions) {
    this.token = opts.personalAccessToken;
    this.baseUrl = opts.baseUrl ?? ASANA_API_BASE;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async getUsersMe(): Promise<AsanaUser> {
    const body = await this.request<{ data: AsanaUser }>(
      "GET",
      "/users/me?opt_fields=gid,name",
    );
    return body.data;
  }

  async getProject(projectGid: string): Promise<AsanaProject> {
    const body = await this.request<{ data: AsanaProject }>(
      "GET",
      `/projects/${projectGid}?opt_fields=gid,name`,
    );
    return body.data;
  }

  async getTask(taskGid: string): Promise<AsanaTaskDetails> {
    const params = new URLSearchParams();
    params.set(
      "opt_fields",
      "gid,name,modified_at,notes,parent.gid,parent.name,parent.notes",
    );
    const body = await this.request<{ data: AsanaTaskDetails }>(
      "GET",
      `/tasks/${taskGid}?${params.toString()}`,
    );
    return body.data;
  }

  async getTasksInProject(
    projectGid: string,
    opts: { modifiedSince?: string; limit?: number } = {},
  ): Promise<AsanaTask[]> {
    const params = new URLSearchParams();
    params.set("opt_fields", "gid,name,modified_at");
    params.set("limit", String(opts.limit ?? 100));
    if (opts.modifiedSince) {
      // Asana supports `modified_since` as a task list filter.
      params.set("modified_since", opts.modifiedSince);
    }
    const body = await this.request<{ data: AsanaTask[] }>(
      "GET",
      `/projects/${projectGid}/tasks?${params.toString()}`,
    );
    return body.data ?? [];
  }

  async getStoriesForTask(taskGid: string): Promise<AsanaStory[]> {
    const params = new URLSearchParams();
    params.set(
      "opt_fields",
      "gid,created_at,created_by.gid,created_by.name,html_text,text,resource_subtype,type",
    );
    params.set("limit", "100");
    const body = await this.request<{ data: AsanaStory[] }>(
      "GET",
      `/tasks/${taskGid}/stories?${params.toString()}`,
    );
    return body.data ?? [];
  }

  async createStoryOnTask(
    taskGid: string,
    input: { text?: string; htmlText?: string },
  ): Promise<AsanaStory> {
    const data: Record<string, string> = {};
    if (input.htmlText !== undefined) data.html_text = input.htmlText;
    else if (input.text !== undefined) data.text = input.text;
    else throw new Error("createStoryOnTask requires text or htmlText");

    const body = await this.request<{ data: AsanaStory }>(
      "POST",
      `/tasks/${taskGid}/stories`,
      { data },
    );
    return body.data;
  }

  async createSubtask(
    parentTaskGid: string,
    input: { name: string },
  ): Promise<AsanaTask> {
    const body = await this.request<{ data: AsanaTask }>(
      "POST",
      `/tasks/${parentTaskGid}/subtasks`,
      { data: { name: input.name } },
    );
    return body.data;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    jsonBody?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    let attempt = 0;
    while (true) {
      attempt++;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await this.fetchImpl(url, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/json",
            ...(jsonBody !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
          },
          body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
          signal: controller.signal,
        });

        if (res.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
          const delayMs = Math.max(1000, retryAfter * 1000);
          logger.warn(
            { path, attempt, retryAfter },
            "Asana rate limited, retrying",
          );
          await sleep(delayMs);
          continue;
        }

        if (res.status >= 500 && res.status < 600 && attempt < MAX_RETRIES) {
          logger.warn(
            { path, attempt, status: res.status },
            "Asana server error, retrying",
          );
          await sleep(500 * attempt);
          continue;
        }

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            `Asana ${method} ${path} failed: ${res.status} ${text.slice(0, 200)}`,
          );
        }

        return (await res.json()) as T;
      } finally {
        clearTimeout(timeout);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
