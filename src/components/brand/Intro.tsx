import { Wordmark } from "./Mark";
import { IntroStage } from "./IntroStage";

// Runs while the HTML is parsed, before the overlay below paints. It opts in only once per tab session and never
// under reduced motion. Without JS the overlay stays display:none. It records the start time so the 3D scene, which
// loads later, stays in step with the CSS timeline. Skip on any click, tap or key; the attribute is removed when
// the fade ends, so client-side navigation back to the home page never replays it.
const guard = `try{var d=document.documentElement;if(!sessionStorage.getItem("as-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("as-intro","1");window.__asIntroT0=performance.now();d.dataset.intro="play";var s=function(){if(d.dataset.intro==="play")d.dataset.intro="skip"};addEventListener("pointerdown",s,{once:true});addEventListener("keydown",s,{once:true});addEventListener("animationend",function e(v){if(v.animationName==="as-intro-out"){delete d.dataset.intro;removeEventListener("animationend",e)}})}}catch(e){}`;

/** ~3.65 s brand intro (2 s × --intro-k) over the already-rendered home page: two books land as A A, then the name. Fixed position: no layout shift. */
export function Intro() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: guard }} />
      <div className="as-intro" aria-hidden="true">
        <IntroStage />
        <Wordmark className="as-intro-word relative text-[clamp(2.5rem,1.5rem+5vw,5rem)]" />
      </div>
    </>
  );
}
