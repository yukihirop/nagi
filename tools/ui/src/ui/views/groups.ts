import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

export function renderGroups(_app: NagiApp): TemplateResult {
  return html`
    <div class="card">
      <div class="empty-state">
        <p>No groups registered</p>
        <p style="font-size: var(--font-size-xs); margin-top: var(--spacing-sm)">
          Groups will appear here when the orchestrator is connected
        </p>
      </div>
    </div>
  `;
}
