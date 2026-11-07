// Runs while the HTML is parsed, before the hero paints. Once per tab session, never under reduced
// motion; without JS nothing is hidden. Any input skips it. "play" holds the page behind the empty
// ground until the timeline is ready; the timeline (brand/Intro.tsx) then sets "run" and clears it at
// the end. If the code never arrives a timer clears "play", so the page can never stay hidden. An
// ?intro= link replays it every time (for previews); ?intro=off skips it outright.
//
// A separate file rather than an inline script so the Content-Security-Policy can stay
// `script-src 'self'` with no 'unsafe-inline'.
try {
  var d = document.documentElement;
  if (
    !location.search.includes("intro=off") &&
    (/[?&]intro=/.test(location.search) || !sessionStorage.getItem("as-intro")) &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    sessionStorage.setItem("as-intro", "1");
    d.dataset.intro = "play";
    var c = function () {
      delete d.dataset.intro;
    };
    var s = function () {
      if (d.dataset.intro === "play" || d.dataset.intro === "run") {
        d.dataset.intro = "skip";
        setTimeout(c, 400);
      }
    };
    ["pointerdown", "keydown", "wheel", "touchmove"].forEach(function (e) {
      addEventListener(e, s, { once: true, passive: true });
    });
    setTimeout(function () {
      if (d.dataset.intro === "play") c();
    }, 6000);
  }
} catch {}
