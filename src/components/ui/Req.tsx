/** A label's text with the red star that marks a mandatory field. The star is for the eye; the input's `required` is what a screen reader hears. */
export function Req({ children }: { children: React.ReactNode }) {
  return (
    <span>
      {children}
      <span aria-hidden="true" className="text-down">
        {" "}*
      </span>
    </span>
  );
}
