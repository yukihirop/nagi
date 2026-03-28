export interface HooksConfig {
  /** Enable PostToolUse hook — sends tool execution log to chat channel */
  postToolUse?: boolean;
  /** Enable SessionStart hook — sends "Thinking..." message on session start */
  sessionStart?: boolean;
  /** Additional tool names to skip (mcp__nagi__send_message is always skipped) */
  skipTools?: string[];
}

/** Default hooks config with all hooks enabled */
export function defaultHooksConfig(): HooksConfig {
  return {
    postToolUse: true,
    sessionStart: true,
    skipTools: [],
  };
}
