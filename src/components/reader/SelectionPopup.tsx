"use client";

import React, { useEffect, useState } from "react";
import { X, Volume2, BookOpen, Layers, Type, Sparkles } from "lucide-react";
import { dictionaryService, LookupResult } from "@/services/dictionary-service";
import { useReaderStore } from "@/stores/reader-store";

interface SelectionPopupProps {
  selectedText: string;
  explicitFurigana?: string;
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
  let str = typeof text !== "string" ? parseStructuredNode(text) : text;

  if (str.startsWith("{") && (str.includes("structured-content") || str.includes('"content":'))) {
    try {
      const parsed = JSON.parse(str);
      const cleaned = parseStructuredNode(parsed).trim();
      if (cleaned) str = cleaned;
    } catch {
      str = str
        .replace(/\{"type":"[^"]+","content":|\[|\{|\}|"tag":"[^"]+"|"data":\{[^}]+\}|"style":\{[^}]+\}/g, "")
        .replace(/["\\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  // 1. Remove POS tag brackets like 【形状詞-一般-* | kata sifat-na】 or 【名詞】
  str = str.replace(/【[^】]+】/g, "").trim();

  // 2. Remove etymology notes like "Note orig. written 乃 or 之"
  str = str.replace(/Note\s+(orig\.|:).*?(?=\[\d+\]|①|②|③|•|$)/gi, "");

  // 3. Remove Japanese example sentences (e.g. 私のウェブページに来て... Visit my webpage...)
  str = str.replace(/[\u3040-\u30ff\u4e00-\u9faf][^.[\]]*?(\.|\?|!|\s)+[A-Z][^.[\]]*?(\.|\?|!|$)/g, "");

  // 4. Remove raw Kokugo monolingual dictionary structural symbols & compound example blocks:
  // e.g. 《格助》, 「わたしー本・本校ー生徒...」, 「ー・、ー！」, 「一」, 「ー〔＝〕」, ○○, ＊＊, etc.
  str = str
    .replace(/《[^》]*》/g, "")
    .replace(/「[^」]*」/g, "")
    .replace(/〔[^〕]*〕/g, "")
    .replace(/[＊*○◯]{2,}/g, "")
    .replace(/[・…\.。]{2,}/g, " ")
    .replace(/（\s*）|\(\s*\)/g, "");

  // 5. Format numbered points [1], [2], ①, ② into clean bullet separators
  str = str
    .replace(/\[\d+\]/g, " • ")
    .replace(/[①-⑳]/g, " • ");

  // 6. Shorten long parenthetical notes if text is long (> 70 chars)
  if (str.length > 70) {
    str = str.replace(/\s*\([^)]*\)/g, "");
  }

  // Clean up double bullets, leading/trailing whitespace
  str = str
    .replace(/•\s*•/g, "•")
    .replace(/^\s*•\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  // If the remaining text is just leftover symbols or punctuation with no real words, return empty
  const meaningfulChars = str.replace(/[•.,;:!?()（）「」『』【】〔〕/\\_\-\s\d①-⑳a-zA-Z]/g, "");
  if (str.length > 0 && meaningfulChars.length === 0 && !/[a-zA-Z0-9]/.test(str)) {
    return "";
  }

  return str;
}

const KANJI_JLPT_MAP: Record<string, string> = {
  // N5
  "一":"N5","二":"N5","三":"N5","四":"N5","五":"N5","六":"N5","七":"N5","八":"N5","九":"N5","十":"N5",
  "百":"N5","千":"N5","万":"N5","円":"N5","校":"N5","前":"N5","後":"N5","左":"N5","右":"N5",
  "大":"N5","小":"N5","中":"N5","月":"N5","日":"N5","年":"N5","火":"N5","水":"N5","木":"N5","金":"N5",
  "土":"N5","山":"N5","川":"N5","田":"N5","人":"N5","口":"N5","車":"N5","門":"N5","学":"N5","生":"N5",
  "先":"N5","私":"N5","本":"N5","天":"N5","気":"N5","雨":"N5","電":"N5","花":"N5","魚":"N5","耳":"N5",
  "手":"N5","足":"N5","目":"N5","力":"N5","男":"N5","女":"N5","子":"N5","父":"N5","母":"N5","友":"N5",
  "毎":"N5","何":"N5","国":"N5","道":"N5","駅":"N5","社":"N5","店":"N5","東":"N5","西":"N5",
  "南":"N5","北":"N5","上":"N5","下":"N5","分":"N5","時":"N5","半":"N5","間":"N5","午":"N5","今":"N5",
  "朝":"N5","昼":"N5","夜":"N5","長":"N5","高":"N5","安":"N5","新":"N5",
  "古":"N5","多":"N5","少":"N5","早":"N5","白":"N5","赤":"N5","青":"N5","黒":"N5","見":"N5","聞":"N5",
  "書":"N5","読":"N5","話":"N5","買":"N5","行":"N5","来":"N5","出":"N5","入":"N5","立":"N5","休":"N5",
  "食":"N5","飲":"N5","会":"N5","言":"N5","語":"N5","教":"N5","勉":"N5","強":"N5",
  // N4
  "去":"N4","不":"N4","世":"N4","主":"N4","乗":"N4","事":"N4","仕":"N4","代":"N4","以":"N4","体":"N4","作":"N4",
  "使":"N4","借":"N4","元":"N4","兄":"N4","光":"N4","写":"N4","切":"N4","別":"N4","利":"N4","動":"N4",
  "同":"N4","味":"N4","品":"N4","員":"N4","問":"N4","善":"N4","図":"N4","地":"N4","堂":"N4","場":"N4",
  "売":"N4","変":"N4","夏":"N4","夕":"N4","太":"N4","妹":"N4","姉":"N4","始":"N4","字":"N4","家":"N4",
  "宿":"N4","寒":"N4","屋":"N4","工":"N4","市":"N4","帰":"N4","広":"N4","度":"N4","建":"N4","弟":"N4",
  "心":"N4","思":"N4","意":"N4","持":"N4","文":"N4","料":"N4","方":"N4","旅":"N4",
  "族":"N4","明":"N4","春":"N4","映":"N4","服":"N4","業":"N4","楽":"N4","止":"N4",
  "歩":"N4","死":"N4","注":"N4","洗":"N4","洋":"N4","海":"N4","漢":"N4","牛":"N4","物":"N4","特":"N4",
  "犬":"N4","理":"N4","用":"N4","画":"N4","病":"N4","真":"N4","着":"N4","知":"N4","研":"N4","究":"N4",
  "秋":"N4","答":"N4","紙":"N4","終":"N4","考":"N4","者":"N4","肉":"N4","自":"N4",
  "致":"N4","色":"N4","英":"N4","茶":"N4","親":"N4","計":"N4","試":"N4","説":"N4","貸":"N4",
  "質":"N4","走":"N4","起":"N4","転":"N4","近":"N4","送":"N4","通":"N4","速":"N4",
  "遅":"N4","重":"N4","野":"N4","開":"N4","院":"N4","集":"N4",
  "音":"N4","風":"N4","首":"N4","館":"N4",
  // N3
  "進":"N3","政":"N3","議":"N3","連":"N3","対":"N3","部":"N3","相":"N3","定":"N3","実":"N3",
  "決":"N3","全":"N3","表":"N3","戦":"N3","経":"N3","最":"N3","現":"N3","調":"N3","化":"N3","当":"N3",
  "約":"N3","法":"N3","性":"N3","要":"N3","制":"N3","治":"N3","務":"N3","成":"N3","期":"N3",
  "取":"N3","都":"N3","和":"N3","機":"N3","平":"N3","加":"N3","受":"N3","続":"N3","数":"N3",
  "記":"N3","初":"N3","指":"N3","権":"N3","支":"N3","産":"N3","点":"N3","報":"N3","済":"N3","活":"N3",
  "原":"N3","共":"N3","得":"N3","解":"N3","交":"N3","資":"N3","予":"N3","向":"N3","際":"N3","勝":"N3",
  "面":"N3","告":"N3","反":"N3","判":"N3","認":"N3","参":"N3","組":"N3","信":"N3","在":"N3",
  "件":"N3","側":"N3","任":"N3","引":"N3","求":"N3","所":"N3","次":"N3","情":"N3","投":"N3","示":"N3",
  "打":"N3","直":"N3","両":"N3","式":"N3","確":"N3","果":"N3","容":"N3","必":"N3","演":"N3",
  "歳":"N3","争":"N3","談":"N3","能":"N3","位":"N3","置":"N3","流":"N3","格":"N3","疑":"N3","過":"N3",
  "局":"N3","放":"N3","常":"N3","状":"N3","球":"N3","職":"N3","与":"N3","供":"N3","役":"N3","構":"N3",
  "割":"N3","身":"N3","費":"N3","由":"N3","難":"N3","優":"N3","夫":"N3","収":"N3",
  "断":"N3","恥":"N3","焦":"N3","俺":"N3","僕":"N3","暑":"N3","波":"N3","帆":"N3","退":"N3",
  // N2
  "瀬":"N2","猛":"N2","党":"N2","協":"N2","総":"N2","区":"N2","領":"N2","県":"N2","設":"N2","保":"N2","改":"N2","第":"N2",
  "結":"N2","派":"N2","府":"N2","査":"N2","委":"N2","軍":"N2","案":"N2","基":"N2","島":"N2","提":"N2",
  "企":"N2","検":"N2","藤":"N2","沢":"N2","裁":"N2","証":"N2","援":"N2","施":"N2",
  "井":"N2","護":"N2","展":"N2","態":"N2","鮮":"N2","視":"N2","条":"N2","幹":"N2","独":"N2","宮":"N2",
  "率":"N2","衛":"N2","張":"N2","監":"N2","審":"N2","義":"N2","訴":"N2","株":"N2","姿":"N2","閣":"N2",
  "韓":"N2","徴":"N2","題":"N2","罰":"N2","責":"N2","就":"N2","創":"N2","造":"N2",
  // N1
  "猛":"N1","氏":"N1","民":"N1","関":"N1","論":"N1","術":"N1","築":"N1","憲":"N1","障":"N1"
};

function getTermJLPT(expression: string, explicitJlpt?: string): string | undefined {
  const kanjis = expression.match(/[\u4e00-\u9faf]/g);
  if (!kanjis || kanjis.length === 0) return explicitJlpt;

  const levels = ["N5", "N4", "N3", "N2", "N1"];
  let highestLevel: string | undefined = undefined;
  let maxRank = -1;

  for (const k of kanjis) {
    const lvl = KANJI_JLPT_MAP[k];
    if (lvl) {
      const rank = levels.indexOf(lvl);
      if (rank > maxRank) {
        maxRank = rank;
        highestLevel = lvl;
      }
    }
  }

  if (explicitJlpt) {
    const explicitRank = levels.indexOf(explicitJlpt);
    if (explicitRank > maxRank) {
      highestLevel = explicitJlpt;
    }
  }

  // Fallback: If kanji exists in word but not in basic N5-N2 map, it is an advanced N1 kanji!
  if (!highestLevel && !explicitJlpt && kanjis.length > 0) {
    highestLevel = "N1";
  }

  return highestLevel || explicitJlpt;
}

function getScriptBadge(text: string, jlpt?: string): { label: string; bg: string; color: string; border: string } | null {
  const clean = text.trim();
  if (!clean) return null;

  // Pure Hiragana
  if (/^[\u3040-\u309f]+$/.test(clean)) {
    return {
      label: "Hiragana",
      bg: "rgba(168, 85, 247, 0.15)",
      color: "#c084fc",
      border: "rgba(168, 85, 247, 0.3)",
    };
  }

  // Pure Katakana
  if (/^[\u30a0-\u30ff]+$/.test(clean)) {
    return {
      label: "Katakana",
      bg: "rgba(20, 184, 166, 0.15)",
      color: "#2dd4bf",
      border: "rgba(20, 184, 166, 0.3)",
    };
  }

  // Contains Kanji
  if (/[\u4e00-\u9faf]/.test(clean)) {
    const computedJlpt = getTermJLPT(clean, jlpt);
    return {
      label: computedJlpt ? `Kanji ${computedJlpt}` : "Kanji",
      bg: "rgba(245, 158, 11, 0.15)",
      color: "#fbbf24",
      border: "rgba(245, 158, 11, 0.3)",
    };
  }

  return null;
}

function parseMeaningPoints(meanings: string[]): string[] {
  const result: string[] = [];
  for (const m of meanings) {
    if (!m) continue;
    const parts = m
      .split(/(?:•|;|\n)\s*/)
      .map((p) => p.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter((p) => p.length > 0);

    for (const p of parts) {
      if (!result.includes(p)) {
        result.push(p);
      }
    }
  }
  return result;
}

export function SelectionPopup({ selectedText, explicitFurigana, position, onClose }: SelectionPopupProps) {
  const [activeTab, setActiveTab] = useState<"def" | "breakdown" | "kanji">("def");
  const [lookupData, setLookupData] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [translationText, setTranslationText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

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

    // Fetch Full Sentence Translation (Disabled for now until active Gemini API key is provided in .env.local)
    /*
    const clean = selectedText.trim();
    if (clean) {
      setIsTranslating(true);
      fetch(`/api/translate?q=${encodeURIComponent(clean)}`)
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data.translation) {
            setTranslationText(data.translation);
          }
        })
        .catch((err) => {
          console.warn("Translation route fetch error:", err);
        })
        .finally(() => {
          if (isMounted) setIsTranslating(false);
        });
    }
    */

    return () => {
      isMounted = false;
    };
  }, [selectedText]);

  // Audio pronunciation via Web Speech API using exact Hiragana reading & ttsSpeed setting
  const { settings } = useReaderStore();
  const ttsRate = settings?.ttsSpeed ?? 0.8;

  const handlePronounce = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      // If user selected a sentence or multi-word phrase (> 5 chars or containing punctuation/spaces), speak the FULL selected text!
      const isSentence = selectedText.length > 5 || /[。、！？\s]/.test(selectedText);
      let textToSpeak = isSentence
        ? selectedText
        : (explicitFurigana || lookupData?.reading || selectedText || "");

      // Fix Web Speech API reading Hiragana 'は' as 'wa' in interjections (e.g. はぁ -> ハァ)
      if (textToSpeak && /^は[ぁあっー!？~…]*$/.test(textToSpeak)) {
        textToSpeak = textToSpeak.replace(/は/g, "ハ");
      }

      if (textToSpeak) {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = "ja-JP";
        utterance.rate = ttsRate;
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  if (!selectedText.trim()) return null;

  // Compute position relative to viewport
  const popupWidth = Math.min(360, window.innerWidth - 32);
  const left = Math.min(Math.max(16, position.x - popupWidth / 2), window.innerWidth - popupWidth - 16);
  const top = Math.max(16, position.y - 190);

  const isSentenceSelection = selectedText.length > 6 || /[。、！？\s]/.test(selectedText);
  // For long sentences, do not show partial furigana (like [さかやなぎきじま]) under the main sentence title.
  // For single words / short phrases, show exact reading (e.g. [さかやなぎ] or [たいがく]).
  const displayReading = !isSentenceSelection ? (explicitFurigana || lookupData?.reading) : undefined;

  return (
    <div
      data-selection-popup="true"
      className="selection-popup"
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
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        animation: "fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        userSelect: "text",
        WebkitUserSelect: "text",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Bar */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          <span
            style={{
              fontSize: "18px",
              fontWeight: 800,
              fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
              color: "#38bdf8",
              lineHeight: 1.35,
              wordBreak: "break-word",
            }}
          >
            {selectedText}
          </span>
          {displayReading && displayReading !== selectedText && (
            <span style={{ fontSize: "12px", color: "#cbd5e1", wordBreak: "break-word" }}>
              [{displayReading}]
            </span>
          )}
        </div>

        {/* Action Buttons (Voice + Close) */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={handlePronounce}
            title="Dengarkan pengucapan"
            style={{
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              backgroundColor: "rgba(56, 189, 248, 0.2)",
              border: "1px solid rgba(56, 189, 248, 0.3)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "transform 0.15s ease",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.9)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <Volume2 style={{ width: "16px", height: "16px" }} />
          </button>

          <button
            onClick={onClose}
            style={{
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X style={{ width: "16px", height: "16px" }} />
          </button>
        </div>
      </div>

      {/* 
        [DISABLED FOR NOW - UNCOMMENT WHEN YOU HAVE AN ACTIVE GEMINI API KEY IN .env.local]
        Full Sentence Translation Card (Bahasa Indonesia)
      */}
      {/* {(translationText || isTranslating) && (
        <div
          style={{
            backgroundColor: "rgba(56, 189, 248, 0.08)",
            borderRadius: "14px",
            padding: "10px 12px",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              color: "#38bdf8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            <Sparkles style={{ width: "13px", height: "13px", color: "#38bdf8" }} />
            <span>Arti Kalimat (Bahasa Indonesia)</span>
          </div>
          <p style={{ fontSize: "13px", color: "#f1f5f9", lineHeight: 1.45, margin: 0, fontWeight: 500 }}>
            {isTranslating && !translationText ? (
              <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>
                Menerjemahkan kalimat...
              </span>
            ) : (
              translationText
            )}
          </p>
        </div>
      )} */}

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
                {(() => {
                  const getDictPriority = (name: string) => {
                    if (name.includes("Indonesian") || name.includes("JIDict")) return 1;
                    if (name.includes("Jitendex") || name.includes("English") || name.includes("JMdict")) return 2;
                    return 3;
                  };

                  const isJapaneseMonolingual = (name: string) => {
                    return /国語|三省堂|広辞苑|大辞林|新明解|明鏡|岩波|大辞泉|学研/i.test(name);
                  };

                  const allRawTerms = lookupData?.terms || [];
                  const hasBilingual = allRawTerms.some((t) => !isJapaneseMonolingual(t.dictName));

                  const validTerms = allRawTerms
                    .filter((t) => !hasBilingual || !isJapaneseMonolingual(t.dictName))
                    .map((t) => ({
                      ...t,
                      cleanMeanings: t.meanings.map(formatMeaning).filter((m) => m.length > 0),
                    }))
                    .filter((t) => t.cleanMeanings.length > 0)
                    .sort((a, b) => getDictPriority(a.dictName) - getDictPriority(b.dictName));

                  if (validTerms.length === 0) {
                    return (
                      <div style={{ textAlign: "center", padding: "16px 0", color: "#94a3b8", fontSize: "12px" }}>
                        Tidak ada pencocokan kamus langsung. Coba lihat tab <b>Bedah Kata</b> untuk rincian kata tunggal.
                      </div>
                    );
                  }

                  return validTerms.map((term, idx) => (
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
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {(() => {
                            const script = getScriptBadge(term.expression, term.jlpt);
                            if (!script) return null;
                            return (
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: "6px",
                                  backgroundColor: script.bg,
                                  color: script.color,
                                  border: `1px solid ${script.border}`,
                                }}
                              >
                                {script.label}
                              </span>
                            );
                          })()}
                          <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "6px", backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
                            {term.dictName}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: "4px" }}>
                        {(() => {
                          const points = parseMeaningPoints(term.cleanMeanings);
                          const useNumbers = points.length > 1;
                          return points.map((point, pIdx) => (
                            <div key={pIdx} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                              <span style={{ color: "#38bdf8", fontWeight: 700, flexShrink: 0, fontSize: "11px" }}>
                                {useNumbers ? `${pIdx + 1}.` : "-"}
                              </span>
                              <span style={{ flex: 1 }}>{point}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  ));
                })()}
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
                      <div style={{ fontSize: "11px", color: "#cbd5e1", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                        {(() => {
                          const points = parseMeaningPoints(seg.meanings.map(formatMeaning));
                          const useNumbers = points.length > 1;
                          return points.map((point, pIdx) => (
                            <div key={pIdx} style={{ display: "flex", gap: "4px", alignItems: "flex-start" }}>
                              <span style={{ color: "#38bdf8", fontWeight: 600, flexShrink: 0 }}>
                                {useNumbers ? `${pIdx + 1}.` : "-"}
                              </span>
                              <span style={{ flex: 1 }}>{point}</span>
                            </div>
                          ));
                        })()}
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
                            width: "42px",
                            height: "42px",
                            borderRadius: "10px",
                            backgroundColor: "rgba(56, 189, 248, 0.15)",
                            color: "#38bdf8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {k.kanji}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2px" }}>
                            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                              Onyomi: {k.onyomi.join(", ") || "-"} | Kunyomi: {k.kunyomi.join(", ") || "-"}
                            </div>
                            {(() => {
                              const effectiveJlpt = k.jlpt || KANJI_JLPT_MAP[k.kanji] || "N1";
                              return (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 800,
                                    padding: "1px 6px",
                                    borderRadius: "6px",
                                    backgroundColor: "rgba(245, 158, 11, 0.2)",
                                    color: "#fbbf24",
                                    border: "1px solid rgba(245, 158, 11, 0.3)",
                                  }}
                                >
                                  {effectiveJlpt}
                                </span>
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "#f1f5f9", marginTop: "2px", display: "flex", flexDirection: "column", gap: "2px" }}>
                            {(() => {
                              const points = parseMeaningPoints(k.meanings.map(formatMeaning));
                              const useNumbers = points.length > 1;
                              return points.map((point, pIdx) => (
                                <div key={pIdx} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                                  <span style={{ color: "#38bdf8", fontWeight: 700, flexShrink: 0, fontSize: "11px" }}>
                                    {useNumbers ? `${pIdx + 1}.` : "-"}
                                  </span>
                                  <span style={{ flex: 1 }}>{point}</span>
                                </div>
                              ));
                            })()}
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
