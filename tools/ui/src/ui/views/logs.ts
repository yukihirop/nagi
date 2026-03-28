import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

export function renderLogs(_app: NagiApp): TemplateResult {
  return html`
    <div class="card">
      <div class="empty-state">
        <p>No logs available</p>
        <p style="font-size: var(--font-size-xs); margin-top: var(--spacing-sm)">
          Logs will stream here when the orchestrator is connected
        </p>
      </div>
    </div>
  `;
}
