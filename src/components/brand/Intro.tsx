// Runs while the HTML is parsed, before the hero paints. Once per tab session, never under reduced motion; without
// JS nothing is hidden. Any input skips it. A timer always clears the attribute, so an interrupted intro can never
// leave the hero copy hidden. The scene itself (Summit) reads the same attribute to play from the top.
const guard = `try{var d=document.documentElement;if(!sessionStorage.getItem("as-intro")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("as-intro","1");d.dataset.intro="play";var c=function(){delete d.dataset.intro};var s=function(){if(d.dataset.intro==="play"){d.dataset.intro="skip";setTimeout(c,400)}};["pointerdown","keydown","wheel","touchmove"].forEach(function(e){addEventListener(e,s,{once:true,passive:true})});setTimeout(c,4400)}}catch(e){}`;

/** The 4 s summit intro: the contour lines rise into the peak, a gold trail climbs it and a flag lands, then the copy rises. */
export function Intro({ skipLabel }: { skipLabel: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: guard }} />
      <button type="button" className="as-intro-skip btn btn-ghost absolute end-4 top-4 z-10 text-small">
        {skipLabel}
      </button>
    </>
  );
}
