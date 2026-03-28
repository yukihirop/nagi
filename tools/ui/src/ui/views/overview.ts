import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

export function renderOverview(app: NagiApp): TemplateResult {
  return html`
    <div class="card-grid">
      <div class="card">
        <div class="card-title">Groups</div>
        <div class="card-value">${app.groupCount}</div>
      </div>
      <div class="card">
        <div class="card-title">Channels</div>
        <div class="card-value">${app.channelCount}</div>
      </div>
      <div class="card">
        <div class="card-title">Queue Depth</div>
        <div class="card-value">${app.queueDepth}</div>
      </div>
      <div class="card">
        <div class="card-title">Scheduled Tasks</div>
        <div class="card-value">${app.taskCount}</div>
      </div>
    </div>

    <div class="section" style="margin-top: var(--spacing-xl)">
      <h2 class="section-title">Recent Activity</h2>
      <div class="card">
        <div class="empty-state">
          <p>No recent activity</p>
          <p style="font-size: var(--font-size-xs); margin-top: var(--spacing-sm)">
            Connect to the orchestrator to see live events
          </p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">System Status</h2>
      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Orchestrator</td>
              <td>
                <span class="badge ${app.connected ? "badge-ok" : "badge-error"}">
                  <span class="status-dot ${app.connected ? "status-dot-ok" : "status-dot-error"}"></span>
                  ${app.connected ? "Connected" : "Disconnected"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
