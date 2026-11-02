"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & { className: string };

/** Password input with an accessible show/hide control. */
export function PasswordField({ name = "password", className, ...rest }: Props) {
  const t = useTranslations("common");
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <span className="relative flex items-center">
      <input id={id} name={name} type={show ? "text" : "password"} className={`${className} w-full pe-11`} {...rest} />
      <button
        type="button"
        aria-label={show ? t("hidePassword") : t("showPassword")}
        aria-controls={id}
        onClick={() => setShow((value) => !value)}
        className="absolute end-1 grid size-10 place-items-center rounded-full text-ink-muted transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-raised hover:text-ink"
      >
        {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
      </button>
    </span>
  );
}
