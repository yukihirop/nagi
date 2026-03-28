export { startCredentialProxy, detectAuthMode } from "./proxy.js";
export type { AuthMode, StartProxyOptions } from "./proxy.js";

// Standalone entry point
if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  const port = parseInt(process.env.CREDENTIAL_PROXY_PORT || "3001", 10);
  const { startCredentialProxy } = await import("./proxy.js");
  await startCredentialProxy({ port });
}
