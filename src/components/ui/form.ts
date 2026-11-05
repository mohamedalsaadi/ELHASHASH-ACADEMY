// The one form-field shape, shared by every form in the app.
// Plain strings (not a "use client" module) so server components can import them too.
export const field = "min-h-11 rounded-sm border border-field bg-surface px-3 text-body text-ink";
export const label = "grid gap-1 text-label text-ink-muted";
/** A bordered surface block for back-office lists and panels. */
export const panel = "grid gap-3 rounded-lg border border-hairline bg-surface p-4 shadow-paper";
