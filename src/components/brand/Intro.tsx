import { Wordmark } from "./Mark";
import { IntroStage } from "./IntroStage";

// Runs while the HTML is parsed, before the overlay below paints. It opts in only once per tab session and never
// under reduced motion. Without JS the overlay stays display:none. It records the start time so the 3D scene, which
// loads later, stays in step with the CSS timeline. Skip on any click, tap, key or scroll gesture (the page is
// scroll-locked underneath, so a wheel or touch drag is the clearest way to say "not now"); the attribute is removed
// when the fade ends, so client-side navigation back to the home page never replays it.
const guard = `try{var d=document.documentElement;if(!sessionStorage.getItem("as-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("as-intro","1");window.__asIntroT0=performance.now();d.dataset.intro="play";var s=function(){if(d.dataset.intro==="play")d.dataset.intro="skip"};addEventListener("pointerdown",s,{once:true});addEventListener("keydown",s,{once:true});addEventListener("click",s,{once:true});addEventListener("wheel",s,{once:true,passive:true});addEventListener("touchmove",s,{once:true,passive:true});var m=matchMedia("(prefers-reduced-motion: reduce)");if(m.addEventListener)m.addEventListener("change",function(e){if(e.matches)s()});addEventListener("animationend",function e(v){if(v.animationName==="as-intro-out"){delete d.dataset.intro;removeEventListener("animationend",e)}})}}catch(e){}`;

/** ~5.5 s brand intro (2 s × --intro-k) over the already-rendered home page: two books land as A A, then the name. Fixed position: no layout shift. */
export function Intro({ skipLabel }: { skipLabel: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: guard }} />
      <div className="as-intro">
        <IntroStage />
        <div aria-hidden="true" className="as-intro-word relative text-[clamp(2.5rem,1.5rem+5vw,5rem)]">
          <Wordmark />
        </div>
        <button
          type="button"
          className="absolute end-6 bottom-6 min-h-11 rounded-sm border border-white/30 bg-white/5 px-4 py-2 font-display text-small text-white/80 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-white/10"
        >
          {skipLabel}
        </button>
      </div>
    </>
  );
}
