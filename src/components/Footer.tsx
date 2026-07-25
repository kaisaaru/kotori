"use client";

import React from "react";
import { BookOpen, ShieldCheck, Zap, Sparkles } from "lucide-react";

const FOOTER_TRANSLATIONS = {
  ID: {
    description: "Platform membaca Light Novel & Web Novel Jepang otentik dengan Kamus Yomitan terintegrasi, pembedah kata otomatis, dan audio pelafalan TTS.",
    highlightsTitle: "KEUNGGULAN PLATFORM",
    privacyText: "Privasi 100% (Penyimpanan Lokal IndexedDB)",
    verticalText: "Support Teks Vertikal (縦書き) & Audio TTS",
    techTitle: "TEKNOLOGI",
    copyright: `© ${new Date().getFullYear()} Kotori. Hak Cipta Dilindungi.`,
    createdBy: "Dibuat oleh",
    forLearners: "untuk Pembaca Light Novel & Pelajar Bahasa Jepang.",
  },
  EN: {
    description: "Authentic Japanese Light Novel & Web Novel reading platform with integrated Yomitan Dictionary, auto text segmenter, and TTS audio pronunciation.",
    highlightsTitle: "PLATFORM HIGHLIGHTS",
    privacyText: "100% Privacy (IndexedDB Local Storage)",
    verticalText: "Vertical Text (縦書き) & TTS Audio Support",
    techTitle: "TECHNOLOGY",
    copyright: `© ${new Date().getFullYear()} Kotori. All Rights Reserved.`,
    createdBy: "Created by",
    forLearners: "for Light Novel Readers & Japanese Learners.",
  },
  JP: {
    description: "Yomitan辞書統合、自動形態素解析、TTS音声朗読を備えた本格派日本語ライトノベル＆ウェブ小説リーダー。",
    highlightsTitle: "プラットフォームの特徴",
    privacyText: "100% プライバシー保護（IndexedDBローカル保存）",
    verticalText: "縦書き表示＆TTS音声朗読対応",
    techTitle: "使用技術",
    copyright: `© ${new Date().getFullYear()} Kotori. 全著作権所有。`,
    createdBy: "作成者：",
    forLearners: "ライトノベル読者＆日本語学習者のために。",
  },
};

interface FooterProps {
  language?: "ID" | "EN" | "JP";
}

export function Footer({ language = "ID" }: FooterProps) {
  const t = FOOTER_TRANSLATIONS[language] || FOOTER_TRANSLATIONS.ID;

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
              <img
                src="/icon.png"
                alt="Kotori"
                style={{
                  width: "32px",
                  height: "32px",
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "19px",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "var(--kb-text)",
                }}
              >
                Kotori
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
              {t.description}
            </p>
          </div>

          {/* Core Feature Highlights */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--kb-text-secondary)" }}>
              {t.highlightsTitle}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", color: "var(--kb-text-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShieldCheck style={{ width: "16px", height: "16px", color: "var(--kb-primary)" }} />
                <span>{t.privacyText}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles style={{ width: "16px", height: "16px", color: "var(--kb-primary)" }} />
                <span>{t.verticalText}</span>
              </div>
            </div>
          </div>

          {/* Quick Info & Tech Stack */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--kb-text-secondary)" }}>
              {t.techTitle}
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
            gap: "12px",
            fontSize: "12px",
            color: "var(--kb-text-muted)",
            lineHeight: 1.6,
            paddingBottom: "16px",
          }}
        >
          <div style={{ lineHeight: 1.6 }}>
            {t.copyright}
          </div>
          <div style={{ lineHeight: 1.6 }}>
            {t.createdBy} <strong style={{ color: "var(--kb-text)" }}>@Kai</strong> {t.forLearners}
          </div>
        </div>
      </div>
    </footer>
  );
}
