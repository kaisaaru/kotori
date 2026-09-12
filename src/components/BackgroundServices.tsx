"use client";

import { DictionaryPrewarmer } from "@/components/DictionaryPrewarmer";
import { WebMcpTools } from "@/components/WebMcpTools";

export function BackgroundServices() {
  return (
    <>
      <DictionaryPrewarmer />
      <WebMcpTools />
    </>
  );
}
