"use client";

import React, { useEffect, useState } from "react";
import { X, Volume2, BookOpen, Layers, Type } from "lucide-react";
import { dictionaryService, LookupResult } from "@/services/dictionary-service";

interface SelectionPopupProps {
  selectedText: string;
  position: { x: number; y: number };
  onClose: () => void;
}

function parseStructuredNode(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);

  if (Array.isArray(node)) {
    return node.map(parseStructuredNode).filter(Boolean).join(" ");
  }

  if (typeof node === "object") {
    if (node.content) {
      return parseStructuredNode(node.content);
    }
    if (node.text) {
      return String(node.text);
    }
  }

  return "";
}

function formatMeaning(text: any): string {
  if (!text) return "";
  if (typeof text !== "string") {
    return parseStructuredNode(text).trim();
  }

  if (text.startsWith("{") && (text.includes("structured-content") || text.includes('"content":'))) {
    try {
      const parsed = JSON.parse(text);
      const cleaned = parseStructuredNode(parsed).trim();
      if (cleaned) return cleaned;
    } catch (e) {
      return text
        .replace(/\{"type":"[^"]+","content":|\[|\{|\}|"tag":"[^"]+"|"data":\{[^}]+\}|"style":\{[^}]+\}/g, "")
        .replace(/["\\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return text.trim();
}

export function SelectionPopup({ selectedText, position, onClose }: SelectionPopupProps) {
  const [activeTab, setActiveTab] = useState<"def" | "breakdown" | "kanji">("def");
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    dictionaryService.lookup(selectedText).then((res) => {
      if (isMounted) {
        setLookupData(res);
        setIsLoading(false);
        if (res.terms.length === 0 && res.segmentedWords.length > 0) {
          setActiveTab("breakdown");
        } else if (res.terms.length === 0 && res.kanjiList.length > 0) {
          setActiveTab("kanji");
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedText]);

  // Audio pronunciation via Web Speech API using exact Hiragana reading
  const handlePronounce = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const textToSpeak = lookupData?.reading || selectedText;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "ja-JP";
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!selectedText.trim()) return null;

  // Compute position relative to viewport
  const popupWidth = 360;
  const left = Math.min(Math.max(16, position.x - popupWidth / 2), window.innerWidth - popupWidth - 24);
  const top = Math.max(16, position.y - 180);

  return (
    <div
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${popupWidth}px`,
        zIndex: 100,
        borderRadius: "20px",
        backgroundColor: "rgba(15, 23, 42, 0.94)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow: "0 20px 48px rgba(0, 0, 0, 0.5)",
        color: "#ffffff",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        animation: "fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "20px",
              fontWeight: 800,
              fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
              color: "#38bdf8",
            }}
          >
            {selectedText}
          </span>
          {lookupData?.reading && lookupData.reading !== selectedText && (
            <span style={{ fontSize: "13px", color: "#cbd5e1" }}>
              [{lookupData.reading}]
            </span>
          )}
          <button
            onClick={handlePronounce}
            title="Dengarkan pengucapan"
            style={{
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              backgroundColor: "rgba(56, 189, 248, 0.2)",
              border: "none",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.15s ease",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.9)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Volume2 style={{ width: "16px", height: "16px" }} />
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            borderRadius: "50%",
            width: "28px",
            height: "28px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "none",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          borderRadius: "12px",
          padding: "4px",
        }}
      >
        <button
          onClick={() => setActiveTab("def")}
          style={{
            flex: 1,
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "12px",
            fontWeight: 700,
            border: "none",
            backgroundColor: activeTab === "def" ? "rgba(56, 189, 248, 0.25)" : "transparent",
            color: activeTab === "def" ? "#38bdf8" : "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <BookOpen style={{ width: "14px", height: "14px" }} />
          <span>Arti ({lookupData?.terms.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("breakdown")}
          style={{
            flex: 1,
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "12px",
            fontWeight: 700,
            border: "none",
            backgroundColor: activeTab === "breakdown" ? "rgba(56, 189, 248, 0.25)" : "transparent",
            color: activeTab === "breakdown" ? "#38bdf8" : "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Layers style={{ width: "14px", height: "14px" }} />
          <span>Bedah Kata</span>
        </button>

        <button
          onClick={() => setActiveTab("kanji")}
          style={{
            flex: 1,
            borderRadius: "8px",
            padding: "6px 10px",
            fontSize: "12px",
            fontWeight: 700,
            border: "none",
            backgroundColor: activeTab === "kanji" ? "rgba(56, 189, 248, 0.25)" : "transparent",
            color: activeTab === "kanji" ? "#38bdf8" : "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Type style={{ width: "14px", height: "14px" }} />
          <span>Kanji ({lookupData?.kanjiList.length || 0})</span>
        </button>
      </div>

      {/* Content View */}
      <div style={{ maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
        {isLoading ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
            Mencari definisi kamus...
          </div>
        ) : (
          <>
            {/* Tab 1: Definitions */}
            {activeTab === "def" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {lookupData && lookupData.terms.length > 0 ? (
                  lookupData.terms.map((term, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        borderRadius: "12px",
                        padding: "10px 12px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc" }}>
                          {term.expression} ({term.reading})
                        </span>
                        <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "6px", backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                          {term.dictName}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.5 }}>
                        {term.meanings.map((m, mIdx) => (
                          <div key={mIdx}>• {formatMeaning(m)}</div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: "12px" }}>
                    Tidak ada pencocokan kamus langsung. Coba lihat tab <b>Bedah Kata</b> untuk rincian kata tunggal.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Word Breakdown */}
            {activeTab === "breakdown" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {lookupData && lookupData.segmentedWords.length > 0 ? (
                  lookupData.segmentedWords.map((seg, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        borderRadius: "12px",
                        padding: "8px 12px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#38bdf8" }}>
                        {seg.text} {seg.reading ? `(${seg.reading})` : ""}
                      </div>
                      <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "2px" }}>
                        {seg.meanings.map(formatMeaning).join("; ")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: "12px" }}>
                    Tidak ada kata terurai.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Kanji Details */}
            {activeTab === "kanji" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {lookupData && lookupData.kanjiList.length > 0 ? (
                  lookupData.kanjiList.map((k, kIdx) => (
                    <div
                      key={kIdx}
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        borderRadius: "12px",
                        padding: "10px 12px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                          style={{
                            fontSize: "24px",
                            fontWeight: 800,
                            fontFamily: "serif",
                            width: "40px",
                            height: "40px",
                            borderRadius: "10px",
                            backgroundColor: "rgba(56, 189, 248, 0.15)",
                            color: "#38bdf8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {k.kanji}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            Onyomi: {k.onyomi.join(", ") || "-"} | Kunyomi: {k.kunyomi.join(", ") || "-"}
                          </div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "#f1f5f9", marginTop: "2px" }}>
                            {k.meanings.map(formatMeaning).join(", ")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: "12px" }}>
                    Tidak ada karakter Kanji dalam pilihan ini.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
