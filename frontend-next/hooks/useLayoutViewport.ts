"use client";

import { useEffect } from "react";

const DEFAULT_VIEWPORT = "width=device-width, initial-scale=1";

function isNarrowScreen(layoutWidth: number) {
  return window.innerWidth < layoutWidth;
}

/** Fixed desktop viewport on narrow screens; normal responsive width on wide monitors. */
export function useLayoutViewport(layoutWidth: number | undefined) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta || !(meta instanceof HTMLMetaElement) || !layoutWidth) {
      return undefined;
    }

    if (!meta.dataset.defaultViewport) {
      meta.dataset.defaultViewport =
        meta.getAttribute("content") || DEFAULT_VIEWPORT;
    }

    const apply = () => {
      const narrow = isNarrowScreen(layoutWidth);
      document.documentElement.classList.toggle("app-desktop-scale", narrow);
      document.body.classList.toggle("app-desktop-scale", narrow);
      meta.setAttribute(
        "content",
        narrow
          ? `width=${layoutWidth}`
          : meta.dataset.defaultViewport || DEFAULT_VIEWPORT,
      );
    };

    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      document.documentElement.classList.remove("app-desktop-scale");
      document.body.classList.remove("app-desktop-scale");
      meta.setAttribute(
        "content",
        meta.dataset.defaultViewport || DEFAULT_VIEWPORT,
      );
    };
  }, [layoutWidth]);
}
