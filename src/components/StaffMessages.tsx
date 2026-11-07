import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { PUBLIC_CLIENT_NAMESPACES, STAFF_CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-messages";

/** Adds the staff dictionary for /admin and /teacher. Everything else gets only the public one from the root layout. */
export async function StaffMessages({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={pickMessages(messages, [...PUBLIC_CLIENT_NAMESPACES, ...STAFF_CLIENT_NAMESPACES])}>
      {children}
    </NextIntlClientProvider>
  );
}
