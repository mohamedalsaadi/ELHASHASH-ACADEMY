// Runs while the HTML is parsed, before the hero paints. Once per tab session, never under reduced
// motion; without JS nothing is hidden. Any input skips it. "play" holds the hero until the scene is
// ready; the scene (Summit) then sets "run", which starts the mark and the copy together, and clears
// it at the end. If the scene never arrives a timer clears "play", so the hero copy can never stay
// hidden. An ?intro= link replays it every time (for previews).
//
// A separate file rather than an inline script so the Content-Security-Policy can stay
// `script-src 'self'` with no 'unsafe-inline'.
try {
  var d = document.documentElement;
  if (
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
