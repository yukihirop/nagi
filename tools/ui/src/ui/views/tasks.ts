import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

export function renderTasks(_app: NagiApp): TemplateResult {
  return html`
    <div class="card">
      <div class="empty-state">
        <p>No scheduled tasks</p>
        <p style="font-size: var(--font-size-xs); margin-top: var(--spacing-sm)">
          Scheduled tasks will appear here when the orchestrator is connected
        </p>
      </div>
    </div>
  `;
}
