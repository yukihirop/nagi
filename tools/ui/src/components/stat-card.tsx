export function StatCard({ title, value, onClick }: { title: string; value: number | string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${onClick ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors" : ""}`}
    >
      <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
