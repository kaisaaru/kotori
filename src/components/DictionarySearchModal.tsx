"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { dictionaryService, LookupResult } from "@/services/dictionary-service";
import { DictionaryResults } from "@/components/DictionaryResults";

interface DictionarySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: "ID" | "EN";
}

const DEBOUNCE_MS = 300;

/**
 * Standalone "type a word, get a definition" search - the same dictionary index the reader's
 * tap-to-lookup popup uses (see DictionaryResults), but reachable without a book open. Requested
 * by a user who kept alt-tabbing to Yomitan just to check a word they weren't currently reading.
 */
export function DictionarySearchModal({ isOpen, onClose, language = "ID" }: DictionarySearchModalProps) {
  const [query, setQuery] = useState("");
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on every open so a stale query/result from the last session doesn't flash before typing.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setLookupData(null);
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setLookupData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      dictionaryService.lookup(trimmed).then((res) => {
        setLookupData(res);
        setIsLoading(false);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div
      className={`kb-feedback-overlay ${isOpen ? "kb-modal-active" : ""}`}
      onClick={onClose}
    >
      <div
        className="kb-feedback-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "480px" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "var(--kb-bg-secondary)",
            color: "var(--kb-text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--kb-border)";
            e.currentTarget.style.color = "var(--kb-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--kb-bg-secondary)";
            e.currentTarget.style.color = "var(--kb-text-secondary)";
          }}
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>

        {/* Title */}
        <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px", color: "var(--kb-text)", paddingRight: "40px", letterSpacing: "-0.02em" }}>
          {language === "ID" ? "Cari Kamus" : "Dictionary Search"}
        </h2>
        <p style={{ fontSize: "13px", color: "var(--kb-text-secondary)", lineHeight: 1.6, marginBottom: "20px" }}>
          {language === "ID"
            ? "Cari arti kata bahasa Jepang langsung, tanpa perlu buka buku."
            : "Look up a Japanese word directly, no book required."}
        </p>

        {/* Search input */}
        <div style={{ position: "relative", marginBottom: "16px" }}>
          <Search
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "16px",
              height: "16px",
              color: "var(--kb-text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={language === "ID" ? "Ketik kata bahasa Jepang..." : "Type a Japanese word..."}
            className="kb-premium-input"
            style={{
              width: "100%",
              padding: "12px 16px 12px 40px",
              fontSize: "14px",
              borderRadius: "12px",
              backgroundColor: "var(--kb-bg)",
              color: "var(--kb-text)",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Results area - keeps the same dark-glass look as the reader's dictionary popup, so a
            looked-up word reads identically whether it came from here or from tapping in a book. */}
        {query.trim() ? (
          <div
            style={{
              minHeight: "280px",
              maxHeight: "50vh",
              borderRadius: "16px",
              backgroundColor: "rgba(15, 23, 42, 0.94)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "#ffffff",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              overflow: "hidden",
            }}
          >
            <DictionaryResults
              selectedText={query.trim()}
              lookupData={lookupData}
              isLoading={isLoading}
              onClose={onClose}
            />
          </div>
        ) : (
          <div
            style={{
              minHeight: "180px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "24px",
              borderRadius: "16px",
              backgroundColor: "var(--kb-bg-secondary)",
              border: "1px dashed var(--kb-border)",
              color: "var(--kb-text-muted)",
              fontSize: "13px",
            }}
          >
            {language === "ID" ? "Mulai ketik untuk mencari kata..." : "Start typing to search a word..."}
          </div>
        )}
      </div>
    </div>
  );
}
