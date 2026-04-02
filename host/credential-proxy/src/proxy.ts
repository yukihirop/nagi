import { createServer, type Server } from "node:http";
import { request as httpsRequest } from "node:https";
import { request as httpRequest, type RequestOptions } from "node:http";
import { readEnvFile } from "@nagi/config";
import { createLogger } from "@nagi/logger";

const logger = createLogger({ name: "credential-proxy" });

export type AuthMode = "api-key" | "oauth";

export interface StartProxyOptions {
  port: number;
  host?: string;
  envPath?: string;
}

export function startCredentialProxy(opts: StartProxyOptions): Promise<Server> {
  const { port, host = "127.0.0.1", envPath } = opts;

  const secrets = readEnvFile(
    [
      "ANTHROPIC_API_KEY",
      "CLAUDE_CODE_OAUTH_TOKEN",
      "ANTHROPIC_AUTH_TOKEN",
      "ANTHROPIC_BASE_URL",
    ],
    envPath,
  );

  const authMode: AuthMode = secrets.ANTHROPIC_API_KEY ? "api-key" : "oauth";
  const oauthToken =
    secrets.CLAUDE_CODE_OAUTH_TOKEN || secrets.ANTHROPIC_AUTH_TOKEN;

  const upstreamUrl = new URL(
    secrets.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
  );
  const isHttps = upstreamUrl.protocol === "https:";
  const makeRequest = isHttps ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        const headers: Record<string, string | number | string[] | undefined> =
          {
            ...(req.headers as Record<string, string>),
            host: upstreamUrl.host,
            "content-length": body.length,
          };

        // Strip hop-by-hop headers
        delete headers["connection"];
        delete headers["keep-alive"];
        delete headers["transfer-encoding"];

        if (authMode === "api-key") {
          delete headers["x-api-key"];
          headers["x-api-key"] = secrets.ANTHROPIC_API_KEY;
        } else {
          if (headers["authorization"]) {
            delete headers["authorization"];
            if (oauthToken) {
              headers["authorization"] = `Bearer ${oauthToken}`;
            }
          }
        }

        const upstream = makeRequest(
          {
            hostname: upstreamUrl.hostname,
            port: upstreamUrl.port || (isHttps ? 443 : 80),
            path: req.url,
            method: req.method,
            headers,
          } as RequestOptions,
          (upRes) => {
            res.writeHead(upRes.statusCode!, upRes.headers);
            upRes.pipe(res);
          },
        );

        upstream.on("error", (err) => {
          logger.error(
            { err, url: req.url },
            "Credential proxy upstream error",
          );
          if (!res.headersSent) {
            res.writeHead(502);
            res.end("Bad Gateway");
          }
        });

        upstream.write(body);
        upstream.end();
      });
    });

    server.listen(port, host, () => {
      logger.info({ port, host, authMode }, "Credential proxy started");
      resolve(server);
    });

    server.on("error", reject);
  });
}

export function detectAuthMode(envPath?: string): AuthMode {
  const secrets = readEnvFile(["ANTHROPIC_API_KEY"], envPath);
  return secrets.ANTHROPIC_API_KEY ? "api-key" : "oauth";
}
