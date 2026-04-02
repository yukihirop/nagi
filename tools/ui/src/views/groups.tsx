import { useData } from "../contexts/data-context.tsx";

export function Groups() {
  const { groups } = useData();
  const entries = Object.entries(groups);

  if (entries.length === 0) {
    return <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">No groups registered</div>;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Channel</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Folder</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Trigger</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Main</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Added</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([jid, g]) => (
            <tr key={jid} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
              <td className="px-4 py-2">{g.name}</td>
              <td className="px-4 py-2"><code className="text-xs">{g.channel}</code></td>
              <td className="px-4 py-2"><code className="text-xs">{g.folder}</code></td>
              <td className="px-4 py-2"><code className="text-xs">{g.trigger}</code></td>
              <td className="px-4 py-2">{g.isMain ? <span className="rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">Main</span> : "—"}</td>
              <td className="px-4 py-2 text-zinc-500">{new Date(g.added_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
