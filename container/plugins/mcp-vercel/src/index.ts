/**
 * Vercel MCP Server for Nagi
 * Exposes Vercel deployment and project management as tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN || "";
const VERCEL_API_BASE = "https://api.vercel.com";

function log(msg: string): void {
  console.error(`[VERCEL] ${msg}`);
}

async function vercelFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Record<string, unknown>> {
  if (!VERCEL_API_TOKEN) {
    throw new Error("VERCEL_API_TOKEN is not set");
  }
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${VERCEL_API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${VERCEL_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Vercel API error ${res.status}: ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

const server = new McpServer({
  name: "vercel",
  version: "1.0.0",
});

server.tool(
  "vercel_list_projects",
  "List Vercel projects",
  {
    limit: z
      .number()
      .optional()
      .describe("Max projects to return (default 20)"),
  },
  async ({ limit }) => {
    log("Listing projects");
    const data = (await vercelFetch(
      `/v9/projects?limit=${limit || 20}`,
    )) as Record<string, unknown>;
    const projects = (data.projects as Array<Record<string, unknown>>).map(
      (p) => ({
        name: p.name,
        id: p.id,
        framework: p.framework,
        url:
          (p.targets as Record<string, Record<string, unknown>>)?.production
            ?.url || null,
      }),
    );
    return {
      content: [
        { type: "text" as const, text: JSON.stringify(projects, null, 2) },
      ],
    };
  },
);

server.tool(
  "vercel_create_project",
  "Create a new Vercel project",
  {
    name: z.string().describe("Project name"),
    framework: z
      .string()
      .optional()
      .describe("Framework preset (nextjs, vite, etc.)"),
  },
  async ({ name, framework }) => {
    log(`Creating project: ${name}`);
    const body: Record<string, unknown> = { name };
    if (framework) body.framework = framework;
    const data = await vercelFetch("/v10/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: data.id, name: data.name, framework: data.framework },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "vercel_deploy",
  "Deploy files to Vercel. Returns the deployment URL.",
  {
    name: z.string().describe("Project name"),
    files: z
      .array(
        z.object({
          file: z.string().describe("File path relative to project root"),
          data: z.string().describe("File content as string"),
        }),
      )
      .describe("Array of files to deploy"),
    projectSettings: z
      .object({
        framework: z.string().optional(),
        buildCommand: z.string().optional(),
        outputDirectory: z.string().optional(),
      })
      .optional(),
  },
  async ({ name, files, projectSettings }) => {
    log(`>>> Deploying ${files.length} files to project: ${name}`);

    const body: Record<string, unknown> = {
      name,
      files: files.map((f) => ({
        file: f.file,
        data: Buffer.from(f.data).toString("base64"),
        encoding: "base64",
      })),
      projectSettings: {
        framework: projectSettings?.framework || null,
        buildCommand: projectSettings?.buildCommand ?? "",
        outputDirectory: projectSettings?.outputDirectory ?? "",
      },
    };

    const data = await vercelFetch("/v13/deployments", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const url = data.url ? `https://${data.url}` : null;
    log(`<<< Deploy complete: ${url}`);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: data.id,
              url,
              readyState: data.readyState,
              name: data.name,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "vercel_list_deployments",
  "List recent deployments",
  {
    projectId: z.string().optional().describe("Filter by project ID"),
    limit: z.number().optional().describe("Max deployments (default 10)"),
  },
  async ({ projectId, limit }) => {
    log("Listing deployments");
    let endpoint = `/v6/deployments?limit=${limit || 10}`;
    if (projectId) endpoint += `&projectId=${projectId}`;
    const data = (await vercelFetch(endpoint)) as Record<string, unknown>;
    const deployments = (
      data.deployments as Array<Record<string, unknown>>
    ).map((d) => ({
      id: d.uid,
      url: d.url ? `https://${d.url}` : null,
      state: d.readyState || d.state,
      created: d.created,
      name: d.name,
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(deployments, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "vercel_get_deployment",
  "Get details of a specific deployment",
  { deploymentId: z.string().describe("Deployment ID or URL") },
  async ({ deploymentId }) => {
    log(`Getting deployment: ${deploymentId}`);
    const data = await vercelFetch(`/v13/deployments/${deploymentId}`);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: data.id,
              url: data.url ? `https://${data.url}` : null,
              readyState: data.readyState,
              name: data.name,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.tool(
  "vercel_delete_project",
  "Delete a Vercel project",
  { projectId: z.string().describe("Project ID or name to delete") },
  async ({ projectId }) => {
    log(`Deleting project: ${projectId}`);
    await vercelFetch(`/v9/projects/${projectId}`, { method: "DELETE" });
    return {
      content: [
        { type: "text" as const, text: `Project ${projectId} deleted.` },
      ],
    };
  },
);

if (!VERCEL_API_TOKEN) {
  log("WARNING: VERCEL_API_TOKEN not set. Tools will fail.");
}

const transport = new StdioServerTransport();
await server.connect(transport);
log("Vercel MCP server started");
