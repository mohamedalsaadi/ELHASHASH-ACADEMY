/** Static loading shape; no looping pulse, matching the calm app-page rule. */
export function PageSkeleton({ label, rows = 4, wide = false, className = "" }: { label: string; rows?: number; wide?: boolean; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={`mx-auto grid ${wide ? "max-w-5xl" : "max-w-3xl"} gap-4 px-4 py-12 ${className}`}>
      <span className="sr-only">{label}</span>
      <div className="h-9 w-2/3 rounded-sm bg-raised" />
      <div className="h-4 w-1/2 rounded-sm bg-raised" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-24 rounded-md border border-hairline bg-raised" />
      ))}
    </div>
  );
}
