"use client";

import { useEffect } from "react";
import { dictionaryService } from "@/services/dictionary-service";
import { useDictionaryStore } from "@/stores/dictionary-store";

/**
 * Pre-warms the server dictionary index as soon as the user opens the application, and owns the
 * single poll that tracks its readiness.
 *
 * This component is mounted in the root layout, so it outlives chapter changes and in-app
 * navigation - unlike the reader's settings drawer, which used to do this polling but is unmounted
 * whenever it is closed. Results go into the dictionary store so any component can read them.
 */
export function DictionaryPrewarmer() {
  const setStatus = useDictionaryStore((s) => s.setStatus);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    async function check() {
      const status = await dictionaryService.getStatus();
      if (cancelled || !status) return; // keep the last known status on a failed fetch
      setStatus(status);
      // The index only ever goes from building to ready, so there is nothing left to watch.
      if (status.isReady) stop();
    }

    const start = () => {
      if (cancelled) return;
      check();
      timer = setInterval(check, 5000);
    };

    // Defer dictionary index pre-warming so critical rendering (FCP & LCP) on mobile connections is unhindered
    let idleHandle: number | ReturnType<typeof setTimeout> | null = null;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleHandle = (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => number }).requestIdleCallback(start, { timeout: 2500 });
    } else {
      idleHandle = setTimeout(start, 1500);
    }

    return () => {
      cancelled = true;
      stop();
      if (idleHandle !== null) {
        if (typeof window !== "undefined" && "cancelIdleCallback" in window && typeof idleHandle === "number") {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle as ReturnType<typeof setTimeout>);
        }
      }
    };
  }, [setStatus]);

  return null;
}
