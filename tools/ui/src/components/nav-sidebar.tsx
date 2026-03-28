import type { Tab } from "../types.ts";

const TAB_GROUPS = [
  { label: "Monitor", tabs: [{ id: "overview" as Tab, label: "Overview" }, { id: "groups" as Tab, label: "Groups" }, { id: "channels" as Tab, label: "Channels" }] },
  { label: "Agent", tabs: [{ id: "sessions" as Tab, label: "Sessions" }] },
  { label: "Automation", tabs: [{ id: "tasks" as Tab, label: "Tasks" }] },
  { label: "System", tabs: [{ id: "logs" as Tab, label: "Logs" }, { id: "settings" as Tab, label: "Settings" }] },
];

export function NavSidebar({ tab, onTabChange }: { tab: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <nav className="w-56 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 flex flex-col py-3 overflow-y-auto">
      <div className="flex items-center gap-2 px-4 mb-2">
        <img className="w-6 h-6 rounded" src="./icon.png" alt="" />
        <span className="text-base font-semibold">Nagi</span>
      </div>
      {TAB_GROUPS.map((group) => (
        <div key={group.label} className="mb-3">
          <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {group.label}
          </div>
          {group.tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`w-full text-left px-4 py-1.5 text-sm transition-colors ${
                tab === t.id
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
