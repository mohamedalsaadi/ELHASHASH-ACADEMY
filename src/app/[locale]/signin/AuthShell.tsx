/** Every sign-in, sign-up and token page: one centred form, nothing competing with it. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto grid w-full max-w-md gap-6 px-4 py-12 md:py-20">
      <div className="card grid content-start gap-6 p-6 sm:p-8">{children}</div>
    </main>
  );
}
