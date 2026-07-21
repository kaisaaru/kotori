"use client";

import { useEffect } from "react";

/**
 * Silently pre-warms the server dictionary index in the background 
 * as soon as the user opens the application.
 */
export function DictionaryPrewarmer() {
  useEffect(() => {
    fetch("/api/dictionary/lookup?status=1").catch(() => {});
  }, []);

  return null;
}
