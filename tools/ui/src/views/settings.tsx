import type { ThemeMode } from "../types.ts";

export function Settings({ themeMode, onThemeChange }: { themeMode: ThemeMode; onThemeChange: (mode: ThemeMode) => void }) {
  const modes: { value: ThemeMode; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">Appearance</h2>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <span className="w-32 font-medium text-sm">Theme</span>
          <div className="flex gap-2">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => onThemeChange(m.value)}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  themeMode === m.value
                    ? "bg-indigo-500 text-white"
                    : "border border-zinc-200 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
