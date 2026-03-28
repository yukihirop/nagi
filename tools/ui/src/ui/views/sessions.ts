import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

function renderSessionList(app: NagiApp): TemplateResult {
  if (app.sessions.length === 0) {
    return html`
      <div class="card">
        <div class="empty-state">
          <p>No sessions found</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Group</th>
            <th>Session ID</th>
            <th>Started</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${app.sessions.map(
            (s) => html`
              <tr>
                <td><span class="badge badge-info">${s.groupFolder}</span></td>
                <td><code>${s.sessionId.slice(0, 8)}...</code></td>
                <td>${s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"}</td>
                <td>
                  <button class="btn" @click="${() => app.selectSession(s.sessionId)}">
                    View
                  </button>
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}

function renderChat(app: NagiApp): TemplateResult {
  return html`
    <div style="margin-bottom: var(--spacing-md)">
      <button class="btn" @click="${() => app.clearSession()}">
        &larr; Back to sessions
      </button>
      <span style="margin-left: var(--spacing-sm); color: var(--text-secondary); font-size: var(--font-size-sm)">
        Session: <code>${app.activeSessionId?.slice(0, 8)}...</code>
      </span>
    </div>

    <div class="chat-container">
      ${app.sessionMessages.map((msg) =>
        msg.type === "user" ? renderUserBubble(msg) : renderAssistantBubble(msg),
      )}
    </div>
  `;
}

function renderUserBubble(msg: { content: string; timestamp: string }): TemplateResult {
  return html`
    <div class="chat-row chat-row-user">
      <div class="chat-bubble chat-bubble-user">
        <div class="chat-text">${msg.content}</div>
        <div class="chat-time">${formatTime(msg.timestamp)}</div>
      </div>
    </div>
  `;
}

function renderAssistantBubble(msg: {
  content: string;
  timestamp: string;
  toolUses?: Array<{ name: string }>;
}): TemplateResult {
  return html`
    <div class="chat-row chat-row-assistant">
      <div class="chat-bubble chat-bubble-assistant">
        ${msg.toolUses && msg.toolUses.length > 0
          ? html`
              <div class="chat-tools">
                ${msg.toolUses.map(
                  (t) => html`<span class="badge badge-info">${t.name}</span>`,
                )}
              </div>
            `
          : ""}
        ${msg.content
          ? html`<div class="chat-text">${msg.content}</div>`
          : ""}
        <div class="chat-time">${formatTime(msg.timestamp)}</div>
      </div>
    </div>
  `;
}

function formatTime(ts: string): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function renderSessions(app: NagiApp): TemplateResult {
  if (app.activeSessionId) {
    return renderChat(app);
  }
  return renderSessionList(app);
}
