import { create } from "zustand";
import type { DictionaryStatus } from "@/services/dictionary-service";

interface DictionaryState {
  // null until the first successful status fetch - readiness is unknown, not "not ready".
  status: DictionaryStatus | null;
  setStatus: (status: DictionaryStatus) => void;
}

// Dictionary readiness lives here rather than inside a component because the only thing that used
// to track it was the reader's settings drawer, which is unmounted whenever it is closed - taking
// its poller and its state with it. Keeping it in a store lets the always-mounted prewarmer own the
// polling while any component (reader notice, settings panel) reads the same value.
export const useDictionaryStore = create<DictionaryState>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));
