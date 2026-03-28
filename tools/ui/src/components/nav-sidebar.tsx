import type { Tab } from "../types.ts";

const ICONS: Record<Tab, string> = {
  overview: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4",
  groups: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  channels: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
  sessions: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
  tasks: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  logs: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  settings: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
};

function TabIcon({ tab, className }: { tab: Tab; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[tab]} />
    </svg>
  );
}

const TAB_GROUPS = [
  { label: "Monitor", tabs: [{ id: "overview" as Tab, label: "Overview" }, { id: "groups" as Tab, label: "Groups" }, { id: "channels" as Tab, label: "Channels" }] },
  { label: "Agent", tabs: [{ id: "sessions" as Tab, label: "Sessions" }] },
  { label: "Automation", tabs: [{ id: "tasks" as Tab, label: "Tasks" }] },
  { label: "System", tabs: [{ id: "logs" as Tab, label: "Logs" }, { id: "settings" as Tab, label: "Settings" }] },
];

export function NavSidebar({ tab, collapsed, onTabChange, onToggle }: { tab: Tab; collapsed: boolean; onTabChange: (t: Tab) => void; onToggle: () => void }) {
  return (
    <nav className={`shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col py-3 overflow-y-auto transition-all ${collapsed ? "w-14" : "w-56"}`}>
      <div className={`flex items-center gap-2 px-3 mb-2 ${collapsed ? "justify-center" : ""}`}>
        <img className={`rounded object-contain ${collapsed ? "w-8 h-8" : "w-10 h-10"}`} src="./icon.png" alt="" />
        {!collapsed && <span className="text-base font-semibold">Nagi</span>}
      </div>
      {TAB_GROUPS.map((group) => (
        <div key={group.label} className="mb-3">
          {!collapsed && (
            <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {group.label}
            </div>
          )}
          {group.tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              title={collapsed ? t.label : undefined}
              className={`w-full flex items-center gap-2 py-1.5 text-sm transition-colors ${collapsed ? "justify-center px-2" : "px-4"} ${
                tab === t.id
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <TabIcon tab={t.id} className="w-4 h-4 shrink-0" />
              {!collapsed && t.label}
            </button>
          ))}
        </div>
      ))}
      <div className="mt-auto pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`w-full flex items-center gap-2 py-2 text-sm text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition-colors ${collapsed ? "justify-center px-2" : "px-4"}`}
        >
          <svg className={`w-4 h-4 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
          </svg>
          {!collapsed && "Collapse"}
        </button>
      </div>
    </nav>
  );
}
