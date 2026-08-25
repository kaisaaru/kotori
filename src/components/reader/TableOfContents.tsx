"use client";

import { X, BookOpen, Check } from "lucide-react";
import type { Chapter } from "@/types/book";

interface TableOfContentsProps {
  chapters: Chapter[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export default function TableOfContents({
  chapters,
  currentIndex,
  onSelect,
  onClose,
}: TableOfContentsProps) {
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

      {/* Drawer Panel */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          width: "380px",
          maxWidth: "85vw",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--kb-surface)",
          borderRight: "1px solid var(--kb-border)",
          boxShadow: "8px 0 36px rgba(0,0,0,0.2)",
          color: "var(--kb-text)",
          overflowY: "auto",
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
              <BookOpen style={{ width: "16px", height: "16px" }} />
            </span>
            <h2 style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.01em" }}>
              Table of Contents
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
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

        {/* Subheader */}
        <div
          style={{
            padding: "12px 24px",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            backgroundColor: "var(--kb-bg-secondary)",
            color: "var(--kb-text-muted)",
            borderBottom: "1px solid var(--kb-border-subtle)",
            flexShrink: 0,
          }}
        >
          {chapters.length} {chapters.length === 1 ? "Chapter" : "Chapters"}
        </div>

        {/* Chapter List */}
        <div style={{ padding: "12px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {chapters.map((chapter, index) => {
            const isActive = index === currentIndex;
            return (
              <button
                key={chapter.id}
                onClick={() => onSelect(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  textAlign: "left",
                  fontSize: "14px",
                  fontWeight: isActive ? 700 : 500,
                  backgroundColor: isActive ? "var(--kb-primary-light)" : "transparent",
                  color: isActive ? "var(--kb-primary)" : "var(--kb-text)",
                  border: isActive ? "1px solid var(--kb-primary)" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  width: "100%",
                  boxSizing: "border-box",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "var(--kb-surface-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    backgroundColor: isActive ? "var(--kb-primary)" : "var(--kb-bg-secondary)",
                    color: isActive ? "white" : "var(--kb-text-muted)",
                  }}
                >
                  {index + 1}
                </span>

                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {chapter.title}
                </span>

                {isActive && (
                  <Check
                    style={{
                      width: "16px",
                      height: "16px",
                      flexShrink: 0,
                      color: "var(--kb-primary)",
                      strokeWidth: 2.5,
                      marginLeft: "8px",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
