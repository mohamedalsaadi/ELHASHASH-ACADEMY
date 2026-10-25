"use client";

import type { ComponentProps, ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

type Props = Omit<ComponentProps<typeof Link>, "href" | "className" | "children"> & {
  href: string;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
};

/** A nav link that marks the current section for sighted and screen-reader users. */
export function ActiveLink({ href, className = "", activeClassName = "bg-raised text-ink", children, ...rest }: Props) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`${className} ${active ? activeClassName : ""}`} {...rest}>
      {children}
    </Link>
  );
}
