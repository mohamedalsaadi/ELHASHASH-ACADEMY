// Runs while the HTML is parsed, before the hero paints. Once per tab session, never under reduced motion; without
// JS nothing is hidden. Any input skips it. "play" holds the hero until the scene is ready; the scene (Summit) then
// sets "run", which starts the mark and the copy together, and clears it at the end. If the scene never arrives a
// timer clears "play", so the hero copy can never stay hidden. An ?intro= link replays it every time (for previews). The scene itself (Summit) reads the same attribute to play from the top.
const guard = `try{var d=document.documentElement;if((/[?&]intro=/.test(location.search)||!sessionStorage.getItem("as-intro"))&&!matchMedia("(prefers-reduced-motion: reduce)").matches){sessionStorage.setItem("as-intro","1");d.dataset.intro="play";var c=function(){delete d.dataset.intro};var s=function(){if(d.dataset.intro==="play"||d.dataset.intro==="run"){d.dataset.intro="skip";setTimeout(c,400)}};["pointerdown","keydown","wheel","touchmove"].forEach(function(e){addEventListener(e,s,{once:true,passive:true})});setTimeout(function(){if(d.dataset.intro==="play")c()},6000)}}catch(e){}`;

/** The 4 s intro: the mark draws and its gold point hops onto the peak, then the copy rises. */
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
