"use client";

import { useEffect } from "react";

/** Mirrors CRA App.js `app-shell` / `app-home` classes on document root. */
export function useAppShellDocument(isHome: boolean) {
  useEffect(() => {
    document.documentElement.classList.add("app-shell");
    document.body.classList.add("app-shell");
    document.documentElement.classList.toggle("app-home", isHome);
    document.body.classList.toggle("app-home", isHome);
    return () => {
      document.documentElement.classList.remove("app-shell", "app-home");
      document.body.classList.remove("app-shell", "app-home");
    };
  }, [isHome]);
}
