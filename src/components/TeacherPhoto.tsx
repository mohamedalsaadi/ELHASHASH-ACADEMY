/** Teacher's photo, or their first letter in the brand ring when there is none. */
export function TeacherPhoto({ name, url, size }: { name: string; url: string | null; size: number }) {
  const box = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- any https host the teacher pastes; next/image needs each host listed
    return <img src={url} alt={name} style={box} className="rounded-full border border-hairline object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...box, fontSize: size * 0.4 }}
      className="grid place-items-center rounded-full border-2 border-amber bg-surface font-display font-semibold text-amber"
    >
      {name.trim().charAt(0)}
    </span>
  );
}
