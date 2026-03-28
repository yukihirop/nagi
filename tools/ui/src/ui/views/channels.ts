import { html, type TemplateResult } from "lit";
import type { NagiApp } from "../app.ts";

export function renderChannels(_app: NagiApp): TemplateResult {
  return html`
    <div class="card">
      <div class="empty-state">
        <p>No channels connected</p>
        <p style="font-size: var(--font-size-xs); margin-top: var(--spacing-sm)">
          Channel status will appear here when the orchestrator is connected
        </p>
      </div>
    </div>
  `;
}
