/**
 * The form to save into once an upload ends. Saving another form on the page re-renders every lesson form
 * (they are keyed by render time), so the one the upload started in may be gone: find its replacement by the record id.
 */
export function liveForm(form: HTMLFormElement, recordId: string | undefined) {
  if (form.isConnected || !recordId) return form.isConnected ? form : null;
  return (document.querySelector(`form input[name="id"][value="${CSS.escape(recordId)}"]`) as HTMLInputElement | null)?.form ?? null;
}

/** Tells the site log what happened in the browser; the log never blocks the upload. Staff only (see /api/log). */
export function reportUpload(source: "client.vdo_upload" | "client.pdf_upload", level: "INFO" | "ERROR", message: string, file: File) {
  return fetch("/api/log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source, level, message, path: location.pathname, meta: { size: file.size, type: file.type } }),
    keepalive: true,
  }).catch(() => {});
}
