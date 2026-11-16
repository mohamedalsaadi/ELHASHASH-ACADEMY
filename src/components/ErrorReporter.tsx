"use client";

import { useEffect } from "react";
import { errorText, reportClient } from "@/lib/client-log";

/** Sends uncaught browser errors and unhandled promise rejections to the site log. Renders nothing. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // A cross-origin script error carries no detail; a browser-extension failure is not ours.
      if (!e.message || e.message === "Script error." || /extension:\/\//.test(e.filename ?? "")) return;
      reportClient("client.unhandled", e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => reportClient("client.unhandled", errorText(e.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
