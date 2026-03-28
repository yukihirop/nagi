import { html, type TemplateResult } from "lit";
import { setThemeMode } from "../app-settings.ts";
import type { NagiApp } from "../app.ts";
import type { ThemeMode } from "../theme.ts";

export function renderSettings(app: NagiApp): TemplateResult {
  const modes: { value: ThemeMode; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  return html`
    <div class="section">
      <h2 class="section-title">Appearance</h2>
      <div class="card">
        <table class="table">
          <tbody>
            <tr>
              <td style="width: 200px; font-weight: 500">Theme</td>
              <td>
                <div style="display: flex; gap: var(--spacing-sm)">
                  ${modes.map(
                    (m) => html`
                      <button
                        class="btn ${app.themeMode === m.value ? "btn-primary" : ""}"
                        @click="${() => setThemeMode(app, m.value)}"
                      >
                        ${m.label}
                      </button>
                    `,
                  )}
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-weight: 500">Current</td>
              <td>${app.resolvedTheme}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}
