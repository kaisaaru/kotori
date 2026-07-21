"use client";

import React from "react";
import { BookOpen, ShieldCheck, Zap, Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer
      style={{
        marginTop: "80px",
        borderTop: "1px solid var(--kb-border)",
        backgroundColor: "var(--kb-surface)",
        padding: "40px 24px 32px",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
        }}
      >
        {/* Top Footer Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "32px",
            alignItems: "start",
          }}
        >
          {/* Brand & Tagline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  backgroundColor: "var(--kb-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BookOpen style={{ width: "18px", height: "18px", color: "#ffffff" }} />
              </div>
              <span
                style={{
                  fontSize: "19px",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "var(--kb-text)",
                }}
              >
                Kotoba Reader AI
              </span>
            </div>
            <p
              style={{
                fontSize: "13px",
                lineHeight: 1.6,
                color: "var(--kb-text-muted)",
                maxWidth: "340px",
              }}
            >
              Platform membaca Light Novel & Web Novel Jepang otentik dengan Kamus Yomitan terintegrasi, pembedah kata otomatis, dan audio pelafalan TTS.
            </p>
          </div>

          {/* Core Feature Highlights */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--kb-text-secondary)" }}>
              Keunggulan Platform
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "var(--kb-text-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck style={{ width: "16px", height: "16px", color: "var(--kb-primary)" }} />
                <span>Privasi 100% (Penyimpanan Lokal IndexedDB)</span>
              </div>
              {/* <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Zap style={{ width: "16px", height: "16px", color: "var(--kb-primary)" }} />
                <span>Mesin Kamus Super Cepat (&lt; 1ms)</span>
              </div> */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles style={{ width: "16px", height: "16px", color: "var(--kb-primary)" }} />
                <span>Support Teks Vertikal (縦書き) & Audio TTS</span>
              </div>
            </div>
          </div>

          {/* Quick Info & Tech Stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--kb-text-secondary)" }}>
              Teknologi
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {["Next.js 16", "React 19", "TypeScript", "Tailwind CSS v4", "Yomitan AST", "IndexedDB"].map((tech) => (
                <span
                  key={tech}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 600,
                    backgroundColor: "var(--kb-bg-secondary)",
                    border: "1px solid var(--kb-border-subtle)",
                    color: "var(--kb-text-secondary)",
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", backgroundColor: "var(--kb-border-subtle)", width: "100%" }} />

        {/* Bottom Copyright Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            fontSize: "12px",
            color: "var(--kb-text-muted)",
          }}
        >
          <div>
            © {new Date().getFullYear()} <strong>Kotoba Reader AI</strong>. Hak Cipta Dilindungi.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span>Dibuat oleh</span>
            <strong style={{ color: "var(--kb-text)" }}>@Kai</strong>
            <span>untuk Pembaca Light Novel & Pelajar Bahasa Jepang.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
