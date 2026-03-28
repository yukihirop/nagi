import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

export function renderTasks(app: NagiApp): TemplateResult {
  if (app.tasks.length === 0) {
    return html`
      <div class="card">
        <div class="empty-state">
          <p>No scheduled tasks</p>
        </div>
      </div>
    `;
  }

  return html`
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Schedule</th>
            <th>Status</th>
            <th>Next Run</th>
            <th>Last Run</th>
          </tr>
        </thead>
        <tbody>
          ${app.tasks.map(
            (t) => html`
              <tr>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${t.prompt}</td>
                <td><code>${t.schedule_value}</code> (${t.schedule_type})</td>
                <td>
                  <span class="badge ${t.status === "active" ? "badge-ok" : t.status === "paused" ? "badge-warn" : "badge-info"}">
                    ${t.status}
                  </span>
                </td>
                <td>${t.next_run ? new Date(t.next_run).toLocaleString() : "—"}</td>
                <td>${t.last_run ? new Date(t.last_run).toLocaleString() : "—"}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}
