"use client";

import { useEffect } from "react";
import { errorText, isForeignError, reportClient } from "@/lib/client-log";

/** Sends uncaught browser errors and unhandled promise rejections to the site log. Renders nothing. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // A cross-origin script error carries no detail; injected and third-party scripts are not ours.
      if (!e.message || e.message === "Script error." || isForeignError(e.message, e.filename, window.location.origin)) return;
      reportClient("client.unhandled", e.message);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const text = errorText(e.reason);
      if (!isForeignError(text, undefined, window.location.origin)) reportClient("client.unhandled", text);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
