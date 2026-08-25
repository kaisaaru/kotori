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
  Trash2,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import type { ReaderSettings } from "@/types/book";
import { FONT_FAMILIES } from "@/types/book";
import { dictionaryService, CustomDictionaryMeta } from "@/services/dictionary-service";
import { useDictionaryStore } from "@/stores/dictionary-store";

interface ReaderSettingsPanelProps {
  settings: ReaderSettings;
  onSettingsChange: (partial: Partial<ReaderSettings>) => void;
  onClose: () => void;
  language?: "ID" | "EN";
}

export default function ReaderSettingsPanel({
  settings,
  onSettingsChange,
  onClose,
  language = "ID",
}: ReaderSettingsPanelProps) {
  const [customDicts, setCustomDicts] = useState<CustomDictionaryMeta[]>([]);
  // Read from the shared store rather than polling here: this panel is unmounted whenever the
  // drawer closes, so a local poller restarted from scratch on every reopen and flashed
  // "Memeriksa Status Kamus..." even when the index had long been ready. DictionaryPrewarmer owns
  // the poll now.
  const dictStatus = useDictionaryStore((s) => s.status);

  const refreshCustomDicts = useCallback(async () => {
    const list = await dictionaryService.getCustomDictionaries();
    setCustomDicts(list);
  }, []);

  useEffect(() => {
    refreshCustomDicts();
  }, [refreshCustomDicts]);

  const handleDeleteDict = async (name: string) => {
    await dictionaryService.deleteCustomDictionary(name);
    await refreshCustomDicts();
  };
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
              {language === "ID" ? "Pengaturan Tampilan" : "Display Settings"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={language === "ID" ? "Tutup" : "Close"}
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
          <SettingSection label={language === "ID" ? "Tema Warna" : "Color Theme"}>
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
          <SettingSection label={language === "ID" ? "Arah Teks (方向)" : "Writing Mode (方向)"}>
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
          <SettingSection label={language === "ID" ? "Tipografi (フォント)" : "Typography (フォント)"}>
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
          <SettingSection label={language === "ID" ? "Ukuran Font" : "Font Size"}>
            <SliderControl
              value={settings.fontSize}
              min={12}
              max={36}
              step={1}
              unit="px"
              onDecrement={() => onSettingsChange({ fontSize: Math.max(12, settings.fontSize - 1) })}
              onIncrement={() => onSettingsChange({ fontSize: Math.min(36, settings.fontSize + 1) })}
              onChange={(v) => onSettingsChange({ fontSize: v })}
              decrementLabel={language === "ID" ? "Kurangi Ukuran Font" : "Decrease Font Size"}
              incrementLabel={language === "ID" ? "Tambah Ukuran Font" : "Increase Font Size"}
            />
          </SettingSection>

          {/* ===== Line Height ===== */}
          <SettingSection label={language === "ID" ? "Tinggi Baris" : "Line Height"}>
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
              decrementLabel={language === "ID" ? "Kurangi Tinggi Baris" : "Decrease Line Height"}
              incrementLabel={language === "ID" ? "Tambah Tinggi Baris" : "Increase Line Height"}
            />
          </SettingSection>

          {/* ===== Margin ===== */}
          <SettingSection label={language === "ID" ? "Margin Halaman" : "Page Margin"}>
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
            <SettingSection label={language === "ID" ? "Lebar Maksimum Pembaca" : "Reader Max Width"}>
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
          <SettingSection label={language === "ID" ? "Kecepatan Suara TTS" : "Speech Speed"}>
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

          {/* Toggle Dictionary On/Off */}
          <SettingSection label={language === "ID" ? "Fitur Kamus" : "Dictionary Popup"}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderRadius: "14px",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border-subtle)",
                opacity: dictStatus?.isReady ? 1 : 0.65,
                transition: "all 0.2s ease",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--kb-text)" }}>
                  {language === "ID" ? "Aktifkan Pop-up Kamus" : "Enable Dictionary Pop-up"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--kb-text-muted)", marginTop: "2px" }}>
                  {dictStatus?.isReady
                    ? (language === "ID" ? "Tampilkan kamus otomatis saat menyorot kata pada buku" : "Automatically show the dictionary when you highlight a word in the book")
                    : dictStatus?.isBuilding
                    ? (language === "ID" ? "Kamus sedang disiapkan... (Mohon tunggu)" : "Dictionary is being prepared... (Please wait)")
                    : (language === "ID" ? "Kamus bawaan belum aktif" : "Built-in dictionary isn't active yet")}
                </div>
              </div>

              {/* Toggle Switch Button */}
              <button
                disabled={!dictStatus?.isReady}
                onClick={() => {
                  if (dictStatus?.isReady) {
                    onSettingsChange({ enableDictionary: !(settings.enableDictionary ?? true) });
                  }
                }}
                title={
                  !dictStatus?.isReady
                    ? (language === "ID" ? "Kamus bawaan belum aktif" : "Built-in dictionary isn't active yet")
                    : (settings.enableDictionary ?? true)
                    ? (language === "ID" ? "Matikan Kamus" : "Turn Off Dictionary")
                    : (language === "ID" ? "Hidupkan Kamus" : "Turn On Dictionary")
                }
                style={{
                  width: "48px",
                  height: "26px",
                  borderRadius: "13px",
                  backgroundColor:
                    dictStatus?.isReady && (settings.enableDictionary ?? true)
                      ? "var(--kb-primary)"
                      : "var(--kb-border)",
                  position: "relative",
                  cursor: dictStatus?.isReady ? "pointer" : "not-allowed",
                  border: "none",
                  transition: "all 0.2s ease",
                  flexShrink: 0,
                  opacity: dictStatus?.isReady ? 1 : 0.5,
                }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#ffffff",
                    position: "absolute",
                    top: "3px",
                    left: dictStatus?.isReady && (settings.enableDictionary ?? true) ? "25px" : "3px",
                    transition: "left 0.2s ease",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }}
                    />
                    </button>
                    </div>

                    {/* Dictionary Trigger Mode */}
                    {(settings.enableDictionary ?? true) && dictStatus?.isReady && (
                    <div className="kb-settings-group" style={{ marginTop: "16px" }}>
                    <div className="kb-settings-label" style={{ marginBottom: "10px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--kb-text-muted)",
                      }}
                    >
                      {language === "ID" ? "Mode Pemicu Kamus" : "Dictionary Trigger"}
                    </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        borderRadius: "14px",
                        padding: "4px",
                        backgroundColor: "var(--kb-bg-secondary)",
                        border: "1px solid var(--kb-border-subtle)",
                      }}
                    >
                    {([
                      { value: "click" as const, label: language === "ID" ? "Langsung" : "Click" },
                      { value: "hover" as const, label: language === "ID" ? "Hover Kursor" : "Hover" },
                      { value: "shift" as const, label: language === "ID" ? "Tahan Shift" : "Hold Shift" },
                    ]).map((mode) => {
                      const isActive = settings.dictTrigger === mode.value || (!settings.dictTrigger && mode.value === "click");
                      return (
                        <button
                          key={mode.value}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            borderRadius: "10px",
                            padding: "8px 4px",
                            fontSize: "12px",
                            fontWeight: 700,
                            textAlign: "center",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            backgroundColor: isActive ? "var(--kb-surface)" : "transparent",
                            color: isActive ? "var(--kb-primary)" : "var(--kb-text-secondary)",
                            boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                            border: isActive ? "1px solid var(--kb-border)" : "1px solid transparent",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          onClick={() => onSettingsChange({ dictTrigger: mode.value })}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--kb-text-muted)", marginTop: "8px", lineHeight: 1.4 }}>
                    {settings.dictTrigger === "shift"
                    ? (language === "ID" ? "Kamus hanya muncul jika Anda menahan tombol Shift sambil mengarahkan kursor ke teks." : "The dictionary only appears while you hold Shift and hover the cursor over text.")
                    : settings.dictTrigger === "hover"
                    ? (language === "ID" ? "Kamus otomatis muncul begitu kursor diarahkan ke atas kata (mode scan-menerus, tanpa perlu klik)." : "The dictionary appears automatically as soon as you hover over a word (continuous scan mode, no click needed).")
                    : (language === "ID" ? "Klik/ketuk sekali pada kata untuk langsung memunculkan kamus. Klik di area kosong untuk menyembunyikan/menampilkan toolbar." : "Click/tap a word once to bring up the dictionary. Click empty space to show/hide the toolbar.")}
                    </div>
                    </div>
                    )}
                    </SettingSection>

                    {/* Yomitan Dictionary Manager Section */}
          <SettingSection label={language === "ID" ? "Kelola Kamus Kustom" : "Custom Dictionaries"}>
            <div
              style={{
                borderRadius: "14px",
                padding: "14px",
                backgroundColor: "var(--kb-bg-secondary)",
                border: "1px solid var(--kb-border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "12px", color: "var(--kb-text-secondary)", lineHeight: 1.5 }}>
                {language === "ID"
                  ? <>Impor & Kelola file <b>.zip</b> kamus Yomitan kustom Anda (JIDict, Jitendex, Sanseido, dll.).</>
                  : <>Import & manage your custom Yomitan <b>.zip</b> dictionaries (JIDict, Jitendex, Sanseido, etc.).</>}
              </div>

              {/* Server Dictionary Status Badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  backgroundColor: dictStatus?.isReady ? "rgba(34, 197, 94, 0.12)" : "rgba(234, 179, 8, 0.12)",
                  border: `1px solid ${dictStatus?.isReady ? "rgba(34, 197, 94, 0.3)" : "rgba(234, 179, 8, 0.3)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: dictStatus?.isReady ? "#22c55e" : "#eab308",
                      boxShadow: `0 0 8px ${dictStatus?.isReady ? "#22c55e" : "#eab308"}`,
                    }}
                  />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: dictStatus?.isReady ? "#22c55e" : "#eab308" }}>
                    {dictStatus?.isReady
                      ? (language === "ID" ? "Kamus Bawaan Aktif & Siap" : "Built-in Dictionary Active & Ready")
                      : dictStatus?.isBuilding
                      ? (language === "ID" ? "Sedang Membaca & Mengindeks Kamus..." : "Reading & Indexing Dictionary...")
                      : (language === "ID" ? "Memeriksa Status Kamus..." : "Checking Dictionary Status...")}
                  </span>
                </div>
                {dictStatus?.totalTerms ? (
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--kb-text-muted)" }}>
                    {dictStatus.totalTerms.toLocaleString()} {language === "ID" ? "Entri" : "Entries"}
                  </span>
                ) : null}
              </div>

              {/* Upload Input */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "10px",
                  borderRadius: "10px",
                  backgroundColor: "var(--kb-surface)",
                  border: "1px dashed var(--kb-primary)",
                  color: "var(--kb-primary)",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s ease",
                }}
              >
                {language === "ID" ? "+ Tambah Kamus ZIP Baru" : "+ Add New ZIP Dictionary"}
                <input
                  type="file"
                  accept=".zip"
                  multiple
                  onChange={async (e) => {
                    if (e.target.files) {
                      for (let i = 0; i < e.target.files.length; i++) {
                        const file = e.target.files[i];
                        await dictionaryService.loadZipDictionary(file, file.name);
                      }
                      await refreshCustomDicts();
                      alert(language === "ID" ? "Kamus Yomitan berhasil ditambahkan!" : "Yomitan dictionary added successfully!");
                    }
                  }}
                  style={{ display: "none" }}
                />
              </label>

              {/* List of Uploaded Custom Dictionaries */}
              {customDicts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--kb-text-muted)" }}>
                    {language === "ID" ? `Kamus Terinstal (${customDicts.length}):` : `Installed Dictionaries (${customDicts.length}):`}
                  </div>
                  {customDicts.map((dict) => (
                    <div
                      key={dict.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "10px",
                        backgroundColor: "var(--kb-surface)",
                        border: "1px solid var(--kb-border-subtle)",
                      }}
                    >
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--kb-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {dict.name}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--kb-text-muted)" }}>
                          {(dict.size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDict(dict.name)}
                        title={language === "ID" ? "Hapus Kamus Ini" : "Delete This Dictionary"}
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: "rgba(239, 68, 68, 0.15)",
                          color: "#ef4444",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flexShrink: 0,
                          marginLeft: "8px",
                        }}
                      >
                        <Trash2 style={{ width: "14px", height: "14px" }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
  decrementLabel = "Decrease value",
  incrementLabel = "Increase value",
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
  decrementLabel?: string;
  incrementLabel?: string;
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
        aria-label={decrementLabel}
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
        aria-label={incrementLabel}
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
