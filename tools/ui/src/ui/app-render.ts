import { html, type TemplateResult } from "lit";
import { icon } from "./icons.ts";
import { TAB_GROUPS, iconForTab, titleForTab, type Tab } from "./navigation.ts";
import { renderOverview } from "./views/overview.ts";
import { renderGroups } from "./views/groups.ts";
import { renderChannels } from "./views/channels.ts";
import { renderTasks } from "./views/tasks.ts";
import { renderLogs } from "./views/logs.ts";
import { renderSettings } from "./views/settings.ts";
import type { NagiApp } from "./app.ts";

function renderNav(app: NagiApp): TemplateResult {
  return html`
    <nav class="nav-sidebar">
      <div class="nav-header">
        <img class="nav-header-logo" src="./favicon.svg" alt="" />
        <span class="nav-header-title">Nagi</span>
      </div>
      ${TAB_GROUPS.map(
        (group) => html`
          <div class="nav-group">
            <div class="nav-group-label">${group.label}</div>
            ${group.tabs.map(
              (tab) => html`
                <button
                  class="nav-item"
                  aria-selected="${app.tab === tab}"
                  @click="${() => app.setTab(tab as Tab)}"
                >
                  <span class="nav-item-icon">${icon(iconForTab(tab as Tab))}</span>
                  ${titleForTab(tab as Tab)}
                </button>
              `,
            )}
          </div>
        `,
      )}
    </nav>
  `;
}

function renderActiveView(app: NagiApp): TemplateResult {
  switch (app.tab) {
    case "overview":
      return renderOverview(app);
    case "groups":
      return renderGroups(app);
    case "channels":
      return renderChannels(app);
    case "tasks":
      return renderTasks(app);
    case "logs":
      return renderLogs(app);
    case "settings":
      return renderSettings(app);
    default:
      return renderOverview(app);
  }
}

export function renderApp(app: NagiApp): TemplateResult {
  return html`
    ${renderNav(app)}
    <main class="main-content">
      <header class="main-header">
        <h1 class="main-header-title">${titleForTab(app.tab)}</h1>
        <div class="main-header-actions">
          <button
            class="btn btn-icon"
            title="Toggle theme"
            @click="${() => app.cycleTheme()}"
          >
            ${app.resolvedTheme === "dark" ? icon("sun") : icon("moon")}
          </button>
        </div>
      </header>
      <div class="main-body">
        ${renderActiveView(app)}
      </div>
    </main>
  `;
}
