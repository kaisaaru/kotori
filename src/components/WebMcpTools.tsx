"use client";

import { useEffect } from "react";
import { dictionaryService } from "@/services/dictionary-service";

interface ModelContextTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  annotations?: Record<string, unknown>;
}

interface ModelContext {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

/**
 * Registers a WebMCP tool (navigator.modelContext.registerTool) so AI agents/browsers that support
 * the emerging Web Model Context Protocol can search Kotori's dictionary directly, independent of
 * whether the search modal UI happens to be open. Shipped behind a flag in Chrome 146 as of writing
 * (enable-webmcp-testing) and unsupported everywhere else - feature-detected, so this is a no-op on
 * every other browser. No mainstream agent calls WebMCP tools yet; this is forward-compat only.
 */
export function WebMcpTools() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.modelContext) return;

    const controller = new AbortController();

    navigator.modelContext.registerTool(
      {
        name: "search_japanese_dictionary",
        description:
          "Look up a Japanese word, phrase, or kanji and return its readings, meanings, JLPT level, frequency, pitch accent, and an example sentence when available.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "A Japanese word, phrase, or kanji to look up" },
          },
          required: ["query"],
        },
        execute: async (input) => {
          const query = typeof input.query === "string" ? input.query : "";
          const result = await dictionaryService.lookup(query);
          return {
            query: result.query,
            reading: result.reading,
            terms: result.terms.map((t) => ({
              expression: t.expression,
              reading: t.reading,
              dictionary: t.dictName,
              meanings: t.meanings,
              jlpt: t.jlpt,
              example: t.example,
            })),
            kanji: result.kanjiList,
          };
        },
        annotations: { readOnlyHint: true },
      },
      { signal: controller.signal }
    );

    return () => controller.abort();
  }, []);

  return null;
}
