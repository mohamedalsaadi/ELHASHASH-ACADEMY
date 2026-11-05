// The guard itself is /intro-guard.js, a same-origin file rather than an inline script, so the
// Content-Security-Policy can forbid inline script outright. It must run before the hero paints,
// which is why it is not deferred.
/** The 4 s intro: the mark draws and its gold point hops onto the peak, then the copy rises. */
export function Intro({ skipLabel }: { skipLabel: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/intro-guard.js" />
      <button type="button" className="as-intro-skip btn btn-ghost absolute end-4 top-4 z-10 text-small">
        {skipLabel}
      </button>
    </>
  );
}
