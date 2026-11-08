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
//   800; WebM first, MP4 for Safari. About 80–240 kB.
// - Reduced motion: the poster alone, no video.
// - A pause button (WCAG 2.2.2: anything moving for more than 5 seconds
//   can be paused).

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
  // React sets `muted` as a property, after the element exists: set it here
  // too and start playback, so a browser that checks before autoplay sees it.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    v.play?.().catch(() => setPlaying(false));
  }, [theme, reduced]);

  const frame = `w-full h-auto aspect-video rounded-xl md:rounded-2xl border-2 border-indigo-200 dark:border-gray-600 shadow-2xl ${className}`;

  if (reduced) {
    return <img src={poster} width="1600" height="900" alt={description} decoding="async" className={frame} />;
  }

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play?.().catch(() => {});
    else v.pause();
  };

  return (
    <div className="relative">
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
        className={`${frame} bg-white dark:bg-gray-900`}
      >
        <source src={`/hero/solve-${theme}-1600.webm`} type="video/webm" media="(min-width: 640px)" />
        <source src={`/hero/solve-${theme}-1600.mp4`} type="video/mp4" media="(min-width: 640px)" />
        <source src={`/hero/solve-${theme}-800.webm`} type="video/webm" />
        <source src={`/hero/solve-${theme}-800.mp4`} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause the demonstration" : "Play the demonstration"}
        className="absolute bottom-3 right-3 inline-flex items-center justify-center w-11 h-11 rounded-full bg-gray-900/70 text-white hover:bg-gray-900/85 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 transition-colors"
      >
        {playing ? <Pause className="w-5 h-5" aria-hidden="true" /> : <Play className="w-5 h-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
