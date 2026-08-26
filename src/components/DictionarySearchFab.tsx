"use client";

import { Search } from "lucide-react";

interface DictionarySearchFabProps {
  onClick: () => void;
  language?: "ID" | "EN";
  bottom?: string;
}

/**
 * Fixed bottom-right circular button that expands into a pill revealing its label on hover -
 * pure CSS (see .kb-dict-fab in globals.css) so the width transition stays smooth without
 * measuring text via JS. `bottom` is a prop since the reader needs extra clearance above its
 * own bottom toolbar, unlike the home page.
 */
export function DictionarySearchFab({ onClick, language = "ID", bottom = "24px" }: DictionarySearchFabProps) {
  const label = language === "ID" ? "Cari Kamus" : "Search";
  return (
    <button
      onClick={onClick}
      className={`kb-dict-fab ${language === "ID" ? "kb-dict-fab-id" : "kb-dict-fab-en"}`}
      style={{ bottom }}
      title={label}
      aria-label={label}
    >
      <Search className="kb-dict-fab-icon" />
      <span className="kb-dict-fab-label">{label}</span>
    </button>
  );
}
