import { CIRCLE_PATH, HA_PATH, TICK_PATH, Wordmark } from "./Mark";

// Runs while the HTML is parsed, before the overlay below paints. It opts in only once per tab
// session and never under reduced motion. Without JS the overlay stays display:none.
// Skip on any click, tap or key; the attribute is removed when the fade ends, so client-side
// navigation back to the home page never replays it.
const guard = `try{var d=document.documentElement;if(!sessionStorage.getItem("eh-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("eh-intro","1");d.dataset.intro="play";var s=function(){if(d.dataset.intro==="play")d.dataset.intro="skip"};addEventListener("pointerdown",s,{once:true});addEventListener("keydown",s,{once:true});addEventListener("animationend",function e(v){if(v.animationName==="eh-intro-out"){delete d.dataset.intro;removeEventListener("animationend",e)}})}}catch(e){}`;

/** 1.6 s logo reveal: the pen circles the letter, then ticks it, over the already-rendered home page. Fixed position: no layout shift. */
export function Intro({ locale }: { locale: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: guard }} />
      <div className="eh-intro" aria-hidden="true">
        <div className="grid justify-items-center gap-4">
          <svg width="120" height="120" viewBox="0 0 48 48">
            <path className="eh-line stroke-pen" pathLength={1} d={CIRCLE_PATH} fill="none" strokeWidth="2.6" strokeLinecap="round" />
            <path className="eh-ring fill-ink" d={HA_PATH} />
            <path className="eh-dot stroke-pen" pathLength={1} d={TICK_PATH} fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <Wordmark locale={locale} className="eh-word text-h2" />
        </div>
      </div>
    </>
  );
}
