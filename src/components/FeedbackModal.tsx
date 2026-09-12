"use client";

import React, { useState, useEffect } from "react";
import { X, Sparkles, ShieldAlert, Heart, Send } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "ID" | "EN";
  onToast: (message: string, type?: "success" | "error" | "delete" | "reset") => void;
}

const TRANSLATIONS = {
  ID: {
    feedbackTitle: "Saran & Kritik untuk Kotori",
    feedbackDesc:
      "Kotori dibuat untuk mempermudah membaca & belajar bahasa Jepang. Bagikan ide fitur baru, lapor bug, atau berikan apresiasi kepada developer!",
    catBug: "Lapor Bug / Error",
    catIdea: "Ide Fitur Baru",
    catLove: "Apresiasi / Lainnya",
    msgPlaceholder:
      "Tuliskan saran, kritik, atau detail masalah yang Anda temukan di sini...",
    contactPlaceholder: "Opsional: IG / TikTok atau email Anda jika ingin dibalas",
    sendBtn: "Kirim Pesan",
    sendingBtn: "Mengirim...",
    feedbackSuccess:
      "Terima kasih! Saran & kritik Anda telah terkirim kepada developer.",
    close: "Tutup",
  },
  EN: {
    feedbackTitle: "Feedback & Suggestions",
    feedbackDesc:
      "Kotori is built to make reading Japanese easier. Share feature ideas, report bugs, or send appreciation to the developer!",
    catBug: "Report Bug",
    catIdea: "New Feature Idea",
    catLove: "Appreciation / Other",
    msgPlaceholder:
      "Write your suggestion, feedback, or bug report details here...",
    contactPlaceholder:
      "Optional: Your IG / TikTok handle or email if you'd like a reply",
    sendBtn: "Send Feedback",
    sendingBtn: "Sending...",
    feedbackSuccess: "Thank you! Your feedback has been sent to the developer.",
    close: "Close",
  },
};

export function FeedbackModal({
  isOpen,
  onClose,
  language,
  onToast,
}: FeedbackModalProps) {
  const [category, setCategory] = useState<"idea" | "bug" | "love">("idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [isSending, setIsSending] = useState(false);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    setIsSending(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message,
          contact,
          language,
        }),
      });

      if (res.ok) {
        onToast(t.feedbackSuccess, "success");
        setMessage("");
        setContact("");
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        onToast(data.error || "Gagal mengirim feedback", "error");
      }
    } catch (err) {
      console.error(err);
      onToast("Terjadi kesalahan sistem saat mengirim feedback", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className={`kb-feedback-overlay ${isOpen ? "kb-modal-active" : ""}`}
      onClick={onClose}
    >
      <div className="kb-feedback-content" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label={t.close}
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
            e.currentTarget.style.transform = "rotate(90deg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--kb-bg-secondary)";
            e.currentTarget.style.color = "var(--kb-text-secondary)";
            e.currentTarget.style.transform = "none";
          }}
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>

        {/* Title */}
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 800,
            marginBottom: "8px",
            color: "var(--kb-text)",
            paddingRight: "40px",
            letterSpacing: "-0.02em",
          }}
        >
          {t.feedbackTitle}
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: "var(--kb-text-secondary)",
            lineHeight: 1.6,
            marginBottom: "24px",
          }}
        >
          {t.feedbackDesc}
        </p>

        {/* Category selector */}
        <div
          style={{
            display: "flex",
            padding: "4px",
            backgroundColor: "var(--kb-bg-secondary)",
            borderRadius: "14px",
            border: "1px solid var(--kb-border)",
            gap: "2px",
            marginBottom: "20px",
          }}
        >
          {(["idea", "bug", "love"] as const).map((cat) => {
            const label =
              cat === "bug" ? t.catBug : cat === "idea" ? t.catIdea : t.catLove;
            const isActive = category === cat;

            let CategoryIcon = Sparkles;
            if (cat === "bug") CategoryIcon = ShieldAlert;
            if (cat === "love") CategoryIcon = Heart;

            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="kb-feedback-category-btn"
                style={{
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 750,
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: isActive ? "var(--kb-surface)" : "transparent",
                  color: isActive
                    ? "var(--kb-primary)"
                    : "var(--kb-text-secondary)",
                  boxShadow: isActive
                    ? "0 2px 8px rgba(99,102,241,0.08), 0 1px 2px rgba(0,0,0,0.02)"
                    : "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <CategoryIcon
                  style={{
                    width: "13px",
                    height: "13px",
                    color: isActive ? "var(--kb-primary)" : "inherit",
                  }}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Message textarea */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.msgPlaceholder}
          className="kb-premium-input"
          style={{
            width: "100%",
            minHeight: "130px",
            padding: "14px 16px",
            fontSize: "13.5px",
            lineHeight: 1.6,
            borderRadius: "14px",
            backgroundColor: "var(--kb-bg)",
            color: "var(--kb-text)",
            outline: "none",
            resize: "none",
            fontFamily: "inherit",
            marginBottom: "14px",
          }}
        />

        {/* Contact input */}
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={t.contactPlaceholder}
          className="kb-premium-input"
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: "13px",
            borderRadius: "12px",
            backgroundColor: "var(--kb-bg)",
            color: "var(--kb-text)",
            outline: "none",
            marginBottom: "24px",
            fontFamily: "inherit",
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={isSending || !message.trim()}
          style={{
            width: "100%",
            padding: "14px",
            fontSize: "14px",
            fontWeight: 750,
            borderRadius: "14px",
            border: "none",
            backgroundColor:
              isSending || !message.trim()
                ? "var(--kb-bg-secondary)"
                : "var(--kb-primary)",
            color:
              isSending || !message.trim()
                ? "var(--kb-text-muted)"
                : "#ffffff",
            cursor:
              isSending || !message.trim() ? "not-allowed" : "pointer",
            boxShadow:
              isSending || !message.trim()
                ? "none"
                : "0 4px 16px rgba(99,102,241,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
          onMouseEnter={(e) => {
            if (!isSending && message.trim()) {
              e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
              e.currentTarget.style.boxShadow =
                "0 6px 20px rgba(99,102,241,0.4)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "none";
            e.currentTarget.style.boxShadow =
              isSending || !message.trim()
                ? "none"
                : "0 4px 16px rgba(99,102,241,0.3)";
          }}
        >
          <Send style={{ width: "14px", height: "14px" }} />
          <span>{isSending ? t.sendingBtn : t.sendBtn}</span>
        </button>
      </div>
    </div>
  );
}
