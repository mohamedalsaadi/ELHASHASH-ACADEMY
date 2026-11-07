// Runs while the HTML is parsed, before anything paints: resolves the stored choice or the device setting into
// html[data-theme], so the page never flashes the wrong appearance. A separate file, like /intro-guard.js, so the
// Content-Security-Policy can stay `script-src 'self'`. Without JS the page is light.
try {
  (function () {
    var d = document.documentElement;
    var q = matchMedia("(prefers-color-scheme: dark)");
    var apply = function () {
      var s = localStorage.getItem("theme");
      d.dataset.theme = s === "light" || s === "dark" ? s : q.matches ? "dark" : "light";
    };
    apply();
    q.addEventListener("change", apply);
    window.addEventListener("dhirwa-theme", apply);
  })();
} catch {}
