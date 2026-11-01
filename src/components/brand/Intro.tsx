import { Wordmark } from "./Mark";
import { Network, type NetLine } from "./Network";

// Runs while the HTML is parsed, before the overlay paints. Once per tab session, never under reduced motion; without
// JS the overlay stays display:none. Any input skips it. A timer always clears the attribute, so an interrupted
// animation can never leave the overlay up.
const guard = `try{var d=document.documentElement;if(!sessionStorage.getItem("as-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("as-intro","1");d.dataset.intro="play";var c=function(){delete d.dataset.intro};var s=function(){if(d.dataset.intro==="play"){d.dataset.intro="skip";setTimeout(c,200)}};["pointerdown","keydown","wheel","touchmove"].forEach(function(e){addEventListener(e,s,{once:true,passive:true})});setTimeout(c,1900)}}catch(e){}`;

/** 1.8 s brand intro over the already-rendered home page: the country lines draw into the A+ interchange, then the name. */
export function Intro({ skipLabel, lines }: { skipLabel: string; lines: NetLine[] }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: guard }} />
      <div className="as-intro">
        <div className="grid w-full max-w-3xl justify-items-center gap-8 px-6">
          <Network id="intro" lines={lines} className="w-full" />
          <div aria-hidden="true" className="as-intro-word text-[clamp(2rem,1.4rem+3vw,3.5rem)]">
            <Wordmark />
          </div>
        </div>
        <button
          type="button"
          className="absolute end-6 bottom-6 min-h-11 border-2 border-ink bg-surface px-4 py-2 font-display text-small font-semibold text-ink"
        >
          {skipLabel}
        </button>
      </div>
    </>
  );
}
