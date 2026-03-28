import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

export function renderChannels(app: NagiApp): TemplateResult {
  if (app.channels.length === 0) {
    return html`
      <div class="card">
        <div class="empty-state">
          <p>No channels connected</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Channel</th>
            <th>Type</th>
            <th>Last Message</th>
          </tr>
        </thead>
        <tbody>
          ${app.channels.map(
            (ch) => html`
              <tr>
                <td>${ch.name}</td>
                <td><span class="badge badge-info">${ch.channel}</span></td>
                <td>${ch.is_group ? "Group" : "DM"}</td>
                <td>${ch.last_message_time ? new Date(ch.last_message_time).toLocaleString() : "—"}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}
