import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { renderApp } from "./app-render.ts";
import { handleConnected, handleDisconnected } from "./app-lifecycle.ts";
import {
  setTab as setTabInternal,
  cycleTheme as cycleThemeInternal,
} from "./app-settings.ts";
import type { Tab } from "./navigation.ts";
import type { ResolvedTheme, ThemeMode } from "./theme.ts";

@customElement("nagi-app")
export class NagiApp extends LitElement {
  @state() tab: Tab = "overview";
  @state() themeMode: ThemeMode = "system";
  @state() resolvedTheme: ResolvedTheme = "dark";
  @state() connected = false;

  // Mock data for initial development
  @state() groupCount = 0;
  @state() channelCount = 0;
  @state() queueDepth = 0;
  @state() taskCount = 0;

  // Disable Shadow DOM to use global styles
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    handleConnected(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    handleDisconnected(this);
  }

  render() {
    return renderApp(this);
  }

  setTab(tab: Tab) {
    setTabInternal(this, tab);
  }

  cycleTheme() {
    cycleThemeInternal(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "nagi-app": NagiApp;
  }
}
