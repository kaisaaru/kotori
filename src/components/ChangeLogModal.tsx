"use client";

import { X, Sparkles } from "lucide-react";
import { CHANGELOG } from "@/data/changelog";

interface ChangeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: "ID" | "EN";
}

export function ChangeLogModal({ isOpen, onClose, language = "ID" }: ChangeLogModalProps) {
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
        <button
          onClick={onClose}
          aria-label={language === "ID" ? "Tutup" : "Close"}
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

        <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px", color: "var(--kb-text)", paddingRight: "40px", letterSpacing: "-0.02em" }}>
          Change Log
        </h2>
        <p style={{ fontSize: "13px", color: "var(--kb-text-secondary)", lineHeight: 1.6, marginBottom: "20px" }}>
          {language === "ID"
            ? "Lihat versi Kotori saat ini dan apa saja yang berubah."
            : "See what version of Kotori you're on and what's changed."}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxHeight: "50vh",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          {CHANGELOG.map((entry) => (
            <div
              key={entry.version}
              style={{
                borderRadius: "14px",
                padding: "16px",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <Sparkles style={{ width: "14px", height: "14px", color: "var(--kb-primary)" }} />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--kb-text)" }}>
                  v{entry.version}
                </span>
                <span style={{ fontSize: "12px", color: "var(--kb-text-muted)" }}>
                  {entry.date}
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {(language === "ID" ? entry.changes.id : entry.changes.en).map((change, i) => (
                  <li key={i} style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--kb-text-secondary)" }}>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
