import { Wordmark } from "./Mark";
import { IntroStage } from "./IntroStage";

// Runs while the HTML is parsed, before the overlay below paints. It opts in only once per tab session and never
// under reduced motion. Without JS the overlay stays display:none.
// The overlay opens in "ready": the night ground shows and the page stays hidden, but the clock has not started.
// IntroScene promotes it to "play" once it has actually mounted, so the books are never missed because their chunk
// arrived late. A timer promotes it anyway after 1.2 s, so a blocked or broken WebGL chunk cannot leave a dead overlay.
// The page is hidden by an animation with `fill: both`, so if that animation is ever interrupted the event that
// clears it never arrives and the page would stay blank: a timer always clears the attribute.
const guard = `try{var d=document.documentElement;if(!sessionStorage.getItem("as-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("as-intro","1");d.dataset.intro="ready";var c=function(){delete d.dataset.intro};var go=function(){if(d.dataset.intro==="ready"){window.__asIntroT0=performance.now();d.dataset.intro="play"}};var s=function(){if(d.dataset.intro==="ready"||d.dataset.intro==="play"){go();d.dataset.intro="skip";setTimeout(c,400)}};addEventListener("pointerdown",s,{once:true});addEventListener("keydown",s,{once:true});addEventListener("click",s,{once:true});addEventListener("wheel",s,{once:true,passive:true});addEventListener("touchmove",s,{once:true,passive:true});var m=matchMedia("(prefers-reduced-motion: reduce)");if(m.addEventListener)m.addEventListener("change",function(e){if(e.matches)s()});var k=parseFloat(getComputedStyle(d).getPropertyValue("--intro-k"))||1;setTimeout(go,1200);setTimeout(c,1200+2000*k+800);addEventListener("animationend",function e(v){if(v.animationName==="as-intro-out"){c();removeEventListener("animationend",e)}})}}catch(e){}`;

/** ~2 s brand intro (2 s × --intro-k) over the already-rendered home page: two books land as A A, then the name. Fixed position: no layout shift. */
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
