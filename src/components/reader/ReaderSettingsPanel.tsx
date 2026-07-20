"use client";

import {
  X,
  Sun,
  Moon,
  BookOpen,
  AlignLeft,
  AlignJustify,
  Type,
  Minus,
  Plus,
  Check,
} from "lucide-react";
import type { ReaderSettings } from "@/types/book";
import { FONT_FAMILIES } from "@/types/book";

interface ReaderSettingsPanelProps {
  settings: ReaderSettings;
  onSettingsChange: (partial: Partial<ReaderSettings>) => void;
  onClose: () => void;
}

export default function ReaderSettingsPanel({
  settings,
  onSettingsChange,
  onClose,
}: ReaderSettingsPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          backgroundColor: "var(--kb-overlay)",
          backdropFilter: "blur(2px)",
        }}
        onClick={onClose}
      />

      {/* Panel Drawer */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          width: "420px",
          maxWidth: "90vw",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--kb-surface)",
          borderLeft: "1px solid var(--kb-border)",
          boxShadow: "-8px 0 36px rgba(0,0,0,0.2)",
          color: "var(--kb-text)",
        }}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            display: "flex",
            height: "60px",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            backgroundColor: "var(--kb-surface)",
            borderBottom: "1px solid var(--kb-border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                backgroundColor: "var(--kb-primary-light)",
                color: "var(--kb-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Type style={{ width: "16px", height: "16px" }} />
            </span>
            <h2 style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.01em" }}>
              Display Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--kb-text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "24px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* ===== Theme ===== */}
          <SettingSection label="Color Theme">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {[
                { key: "light" as const, icon: Sun, label: "Light", previewBg: "#ffffff", previewFg: "#1a1a2e" },
                { key: "dark" as const, icon: Moon, label: "Dark", previewBg: "#0f0f14", previewFg: "#e8e8ec" },
                { key: "sepia" as const, icon: BookOpen, label: "Sepia", previewBg: "#f4efe4", previewFg: "#3d3328" },
              ].map(({ key, icon: Icon, label, previewBg, previewFg }) => {
                const isActive = settings.theme === key;
                return (
                  <button
                    key={key}
                    onClick={() => onSettingsChange({ theme: key })}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                      borderRadius: "14px",
                      padding: "14px 8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      backgroundColor: "var(--kb-bg-secondary)",
                      border: isActive
                        ? "2px solid var(--kb-primary)"
                        : "2px solid var(--kb-border-subtle)",
                      color: isActive ? "var(--kb-primary)" : "var(--kb-text)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {/* Color Preview Badge */}
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "10px",
                        backgroundColor: previewBg,
                        color: previewFg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(0,0,0,0.1)",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
                      }}
                    >
                      <Icon style={{ width: "16px", height: "16px" }} />
                    </div>
                    <span>{label}</span>

                    {isActive && (
                      <span
                        style={{
                          position: "absolute",
                          right: "6px",
                          top: "6px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          backgroundColor: "var(--kb-primary)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check style={{ width: "10px", height: "10px", strokeWidth: 3 }} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </SettingSection>

          {/* ===== Writing Mode ===== */}
          <SettingSection label="Writing Mode (方向)">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px",
                borderRadius: "14px",
                padding: "4px",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border-subtle)",
              }}
            >
              {[
                { key: "horizontal" as const, icon: AlignLeft, label: "横書き (Horizontal)" },
                { key: "vertical" as const, icon: AlignJustify, label: "縦書き (Vertical)", rotate: true },
              ].map(({ key, icon: Icon, label, rotate }) => {
                const isActive = settings.writingMode === key;
                return (
                  <button
                    key={key}
                    onClick={() => onSettingsChange({ writingMode: key })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      borderRadius: "10px",
                      padding: "10px",
                      fontSize: "12px",
                      fontWeight: 700,
                      backgroundColor: isActive ? "var(--kb-surface)" : "transparent",
                      color: isActive ? "var(--kb-primary)" : "var(--kb-text-secondary)",
                      boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                      border: isActive ? "1px solid var(--kb-border)" : "1px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Icon style={{ width: "16px", height: "16px", transform: rotate ? "rotate(90deg)" : "none" }} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </SettingSection>

          {/* ===== Font Family ===== */}
          <SettingSection label="Typography (フォント)">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {FONT_FAMILIES.map((font) => {
                const isActive = settings.fontFamily === font.value;
                return (
                  <button
                    key={font.value}
                    onClick={() => onSettingsChange({ fontFamily: font.value })}
                    style={{
                      fontFamily: font.value,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      fontSize: "13px",
                      fontWeight: isActive ? 700 : 400,
                      backgroundColor: isActive ? "var(--kb-primary-light)" : "var(--kb-bg-secondary)",
                      color: isActive ? "var(--kb-primary)" : "var(--kb-text)",
                      border: isActive ? "1px solid var(--kb-primary)" : "1px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontFamily: "serif",
                          opacity: 0.6,
                          color: isActive ? "var(--kb-primary)" : "var(--kb-text-muted)",
                        }}
                      >
                        あ
                      </span>
                      <span>{font.label}</span>
                    </div>
                    {isActive && (
                      <Check style={{ width: "16px", height: "16px", color: "var(--kb-primary)", flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </SettingSection>

          {/* ===== Font Size ===== */}
          <SettingSection label="Font Size">
            <SliderControl
              value={settings.fontSize}
              min={12}
              max={36}
              step={1}
              unit="px"
              onDecrement={() => onSettingsChange({ fontSize: Math.max(12, settings.fontSize - 1) })}
              onIncrement={() => onSettingsChange({ fontSize: Math.min(36, settings.fontSize + 1) })}
              onChange={(v) => onSettingsChange({ fontSize: v })}
            />
          </SettingSection>

          {/* ===== Line Height ===== */}
          <SettingSection label="Line Height">
            <SliderControl
              value={settings.lineHeight}
              min={1.2}
              max={3.0}
              step={0.1}
              unit=""
              formatter={(v) => v.toFixed(1)}
              onDecrement={() =>
                onSettingsChange({ lineHeight: Math.max(1.2, +(settings.lineHeight - 0.1).toFixed(1)) })
              }
              onIncrement={() =>
                onSettingsChange({ lineHeight: Math.min(3.0, +(settings.lineHeight + 0.1).toFixed(1)) })
              }
              onChange={(v) => onSettingsChange({ lineHeight: +v.toFixed(1) })}
            />
          </SettingSection>

          {/* ===== Margin ===== */}
          <SettingSection label="Page Margin">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "4px",
                borderRadius: "14px",
                padding: "4px",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border-subtle)",
              }}
            >
              {(["compact", "normal", "wide"] as const).map((m) => {
                const isActive = settings.margin === m;
                return (
                  <button
                    key={m}
                    onClick={() => onSettingsChange({ margin: m })}
                    style={{
                      borderRadius: "10px",
                      padding: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      textTransform: "capitalize",
                      backgroundColor: isActive ? "var(--kb-surface)" : "transparent",
                      color: isActive ? "var(--kb-primary)" : "var(--kb-text-secondary)",
                      boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                      border: isActive ? "1px solid var(--kb-border)" : "1px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </SettingSection>

          {/* ===== Reader Width (horizontal only) ===== */}
          {settings.writingMode === "horizontal" && (
            <SettingSection label="Reader Max Width">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "4px",
                  borderRadius: "14px",
                  padding: "4px",
                  backgroundColor: "var(--kb-bg-secondary)",
                  border: "1px solid var(--kb-border-subtle)",
                }}
              >
                {(["narrow", "medium", "wide", "full"] as const).map((w) => {
                  const isActive = settings.readerWidth === w;
                  return (
                    <button
                      key={w}
                      onClick={() => onSettingsChange({ readerWidth: w })}
                      style={{
                        borderRadius: "10px",
                        padding: "8px 4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "capitalize",
                        backgroundColor: isActive ? "var(--kb-surface)" : "transparent",
                        color: isActive ? "var(--kb-primary)" : "var(--kb-text-secondary)",
                        boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                        border: isActive ? "1px solid var(--kb-border)" : "1px solid transparent",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {w}
                    </button>
                  );
                })}
              </div>
            </SettingSection>
          )}

          {/* TTS Speech Speed Section */}
          <SettingSection label="Kecepatan Suara TTS / Speech Speed">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "6px",
                backgroundColor: "var(--kb-bg-secondary)",
                borderRadius: "12px",
                padding: "4px",
                border: "1px solid var(--kb-border-subtle)",
              }}
            >
              {[
                { label: "0.5x", value: 0.5 },
                { label: "0.75x", value: 0.75 },
                { label: "0.85x", value: 0.85 },
                { label: "1.0x", value: 1.0 },
                { label: "1.25x", value: 1.25 },
              ].map((speed) => {
                const currentSpeed = settings.ttsSpeed ?? 0.85;
                const isActive = currentSpeed === speed.value;
                return (
                  <button
                    key={speed.value}
                    onClick={() => onSettingsChange({ ttsSpeed: speed.value })}
                    style={{
                      borderRadius: "8px",
                      padding: "8px 2px",
                      fontSize: "12px",
                      fontWeight: 700,
                      backgroundColor: isActive ? "var(--kb-surface)" : "transparent",
                      color: isActive ? "var(--kb-primary)" : "var(--kb-text-secondary)",
                      boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                      border: isActive ? "1px solid var(--kb-border)" : "1px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      textAlign: "center",
                    }}
                  >
                    {speed.label}
                  </button>
                );
              })}
            </div>
          </SettingSection>

          {/* Yomitan Dictionary Section */}
          <SettingSection label="Kamus Yomitan / Dictionary">
            <div
              style={{
                borderRadius: "14px",
                padding: "14px",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "12px", color: "var(--kb-text-secondary)", lineHeight: 1.5 }}>
                Impor file <b>.zip</b> kamus Yomitan (JIDict, Jitendex, Sanseido, NHK Pitch, JLPT) untuk fitur Pop-up Bedah Teks.
              </div>
              <input
                type="file"
                accept=".zip"
                multiple
                onChange={async (e) => {
                  if (e.target.files) {
                    const { dictionaryService } = await import("@/services/dictionary-service");
                    for (let i = 0; i < e.target.files.length; i++) {
                      const file = e.target.files[i];
                      await dictionaryService.loadZipDictionary(file, file.name);
                    }
                    alert("Kamus Yomitan berhasil di-impor ke Kotoba Reader!");
                  }
                }}
                style={{ fontSize: "12px", color: "var(--kb-text)", cursor: "pointer" }}
              />
            </div>
          </SettingSection>
        </div>
      </div>
    </>
  );
}

/* ===== Section Wrapper ===== */
function SettingSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        style={{
          marginBottom: "10px",
          fontSize: "11px",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--kb-text-muted)",
        }}
      >
        {label}
      </h3>
      {children}
    </div>
  );
}

/* ===== Explicit Slider Control ===== */
function SliderControl({
  value,
  min,
  max,
  step,
  unit = "",
  formatter = (v) => `${v}`,
  onDecrement,
  onIncrement,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  formatter?: (v: number) => string;
  onDecrement: () => void;
  onIncrement: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        borderRadius: "14px",
        padding: "10px 14px",
        backgroundColor: "var(--kb-bg-secondary)",
        border: "1px solid var(--kb-border-subtle)",
      }}
    >
      <button
        onClick={onDecrement}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "10px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--kb-surface)",
          border: "1px solid var(--kb-border)",
          color: "var(--kb-text)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface)")}
      >
        <Minus style={{ width: "14px", height: "14px" }} />
      </button>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1,
          minWidth: "80px",
          height: "6px",
          borderRadius: "4px",
          accentColor: "var(--kb-primary)",
          cursor: "pointer",
        }}
      />

      <button
        onClick={onIncrement}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "10px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--kb-surface)",
          border: "1px solid var(--kb-border)",
          color: "var(--kb-text)",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--kb-surface)")}
      >
        <Plus style={{ width: "14px", height: "14px" }} />
      </button>

      <span
        style={{
          width: "48px",
          textAlign: "right",
          fontSize: "13px",
          fontWeight: 700,
          fontFamily: "monospace",
          flexShrink: 0,
          color: "var(--kb-primary)",
        }}
      >
        {formatter(value)}{unit}
      </span>
    </div>
  );
}
