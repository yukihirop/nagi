import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

export function renderGroups(app: NagiApp): TemplateResult {
  const entries = Object.entries(app.groups);

  if (entries.length === 0) {
    return html`
      <div class="card">
        <div class="empty-state">
          <p>No groups registered</p>
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
            <th>Folder</th>
            <th>Trigger</th>
            <th>Main</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(
            ([, g]) => html`
              <tr>
                <td>${g.name}</td>
                <td><code>${g.folder}</code></td>
                <td><code>${g.trigger}</code></td>
                <td>${g.isMain ? html`<span class="badge badge-ok">Main</span>` : "—"}</td>
                <td>${new Date(g.added_at).toLocaleDateString()}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}
