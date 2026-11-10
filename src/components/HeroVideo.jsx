import React, { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import { Pause, Play } from "lucide-react";
import { useDarkMode } from "@/contexts/DarkModeContext";

// The home page's hero (1.70.2): a real recording of the Solver, typing
// x² − 4x + 3 under Functions and solving it, in the visitor's theme. Made
// by scripts/record-hero.mjs; replaced an AI illustration.
//
// - Muted, looping, inline; the solved frame is the poster, preloaded at
//   high priority (it is the page's largest paint), so the page shows at
//   once and the video starts when it can.
// - One file per visitor: the theme's, 1600 px wide from 640 px up, else
//   800; WebM first, MP4 for Safari. About 120–280 kB.
// - Reduced motion: the poster alone, no video.
// - Pausing (WCAG 2.2.2: anything moving for more than 5 seconds can be
//   paused): a tap or click on the video pauses and plays it, with a short
//   flash of the icon; while paused a large play icon stays, so a still
//   frame never looks broken. The button shows on hover and on keyboard
//   focus; faded out, never removed, so a screen reader still finds it.

const REDUCE = "(prefers-reduced-motion: reduce)";
const reducedNow = () => {
  try {
    return window.matchMedia(REDUCE).matches;
  } catch {
    return false;
  }
};

export default function HeroVideo({ description, className = "" }) {
  const { isDarkMode } = useDarkMode();
  const theme = isDarkMode ? "dark" : "light";
  const poster = `/hero/solve-${theme}-poster.webp`;
  preload(poster, { as: "image", fetchPriority: "high" });

  const [reduced, setReduced] = useState(reducedNow);
  useEffect(() => {
    let query;
    try {
      query = window.matchMedia(REDUCE);
    } catch {
      return undefined;
    }
    const onChange = () => setReduced(query.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  // A large play icon while paused by the visitor, or when the browser
  // would not autoplay; never in the moment before autoplay starts.
  const [stopped, setStopped] = useState(false);
  // Just resumed: the play icon shows, then fades.
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef(null);
  useEffect(() => () => clearTimeout(flashTimer.current), []);
  // React sets `muted` as a property, after the element exists: set it here
  // too and start playback, so a browser that checks before autoplay sees it.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    v.play?.().catch(() => { setPlaying(false); setStopped(true); });
  }, [theme, reduced]);

  // A window frame round the recording (1.70.4): a white bezel with a grey
  // border and a shadow, so it stands off the light-blue page.
  const bezel = `p-1.5 sm:p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-md ${className}`;
  const frame = "block w-full h-auto aspect-video rounded-lg border border-gray-200 dark:border-gray-700";

  if (reduced) {
    return (
      <div className={bezel}>
        <img src={poster} width="1600" height="900" alt={description} decoding="async" className={frame} />
      </div>
    );
  }

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    clearTimeout(flashTimer.current);
    if (v.paused) {
      v.play?.().catch(() => {});
      setStopped(false);
      setFlash(true);
      flashTimer.current = setTimeout(() => setFlash(false), 700);
    } else {
      v.pause();
      setStopped(true);
      setFlash(false);
    }
  };
  const big = "inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-900/65 text-white shadow-lg";

  return (
    <div className={bezel}>
    <div className="relative group">
      <video
        key={theme}
        ref={video}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        width="1600"
        height="900"
        aria-label={description}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={toggle}
        className={`${frame} bg-white dark:bg-gray-900 cursor-pointer`}
      >
        <source src={`/hero/solve-${theme}-1600.webm`} type="video/webm" media="(min-width: 640px)" />
        <source src={`/hero/solve-${theme}-1600.mp4`} type="video/mp4" media="(min-width: 640px)" />
        <source src={`/hero/solve-${theme}-800.webm`} type="video/webm" />
        <source src={`/hero/solve-${theme}-800.mp4`} type="video/mp4" />
      </video>
      {/* Paused: a large play icon stays. Just resumed: it shows, then
          fades. It takes no taps (they reach the video). */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className={`${big} transition-opacity duration-300 ${stopped || flash ? "opacity-100" : "opacity-0"}`}>
          <Play className="w-8 h-8 ml-1" />
        </span>
      </span>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause the demonstration" : "Play the demonstration"}
        className="absolute bottom-3 right-3 inline-flex items-center justify-center w-11 h-11 rounded-full bg-gray-900/70 text-white hover:bg-gray-900/85 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 transition-opacity"
      >
        {playing ? <Pause className="w-5 h-5" aria-hidden="true" /> : <Play className="w-5 h-5" aria-hidden="true" />}
      </button>
    </div>
    </div>
  );
}
