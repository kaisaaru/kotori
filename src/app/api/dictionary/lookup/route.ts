import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

interface ServerTerm {
  dictName: string;
  expression: string;
  reading: string;
  meanings: string[];
  tags?: string[];
  rules?: string;
  score?: number;
  pitch?: string;
  jlpt?: string;
}

interface ServerKanji {
  kanji: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
}

let isIndexBuilding = false;
let isIndexReady = false;
const termMap = new Map<string, ServerTerm[]>();
const kanjiMap = new Map<string, ServerKanji>();

// Recursively parse Yomitan Structured Content AST into clean text
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

function cleanMeaningString(text: any): string {
  if (!text) return "";
  if (typeof text !== "string") {
    return parseStructuredNode(text).trim();
  }

  if (text.startsWith("{") && (text.includes("structured-content") || text.includes('"content":'))) {
    try {
      const parsed = JSON.parse(text);
      const cleaned = parseStructuredNode(parsed).trim();
      if (cleaned) return cleaned;
    } catch {
      return text
        .replace(/\{"type":"[^"]+","content":|\[|\{|\}|"tag":"[^"]+"|"data":\{[^}]+\}|"style":\{[^}]+\}/g, "")
        .replace(/["\\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  return text.trim();
}

// Helper to prioritize mainstream dictionaries (JIDict, Jitendex, Sanseido) over niche dictionaries (e.g. やさしい)
function getDictPriority(dictName?: string): number {
  if (!dictName) return 0;
  const lower = dictName.toLowerCase();
  if (lower.includes("jidict")) return 100;
  if (lower.includes("jitendex")) return 90;
  if (lower.includes("三省堂")) return 80;
  if (lower.includes("jpdb")) return 70;
  if (lower.includes("nhk")) return 60;
  if (lower.includes("jlpt")) return 50;
  if (lower.includes("やさしい")) return 10;
  return 30;
}

const PRIMARY_READING_MAP: Record<string, string> = {
  男: "おとこ",
  女: "おんな",
  人: "ひと",
  言: "い",       // 言 -> い (stem for 言う, 言っている, 言った)
  行: "い",       // 行 -> い (stem for 行く, 行っている, 行った)
  見: "み",       // 見 -> み (stem for 見る, 見ている)
  食: "た",       // 食 -> た (stem for 食べる, 食べている)
  書: "か",       // 書 -> か (stem for 書く, 書いている)
  読: "よ",       // 読 -> よ (stem for 読む, 読んでいる)
  聞: "き",       // 聞 -> き (stem for 聞く, 聞いている)
  思: "おも",     // 思 -> おも (stem for 思う, 思っている)
  告: "つ",       // 告 -> つ (stem for 告げる, 告げずに)
  出: "で",       // 出 -> で (stem for 出る, 出た, 出て)
  起: "お",       // 起 -> お (stem for 起きる, 起きた)
  家: "いえ",     // 家 -> いえ (house / home)
  誰: "だれ",     // 誰 -> だれ (who)
  飲: "の",       // 飲 -> の (stem for 飲む, 飲んで, 飲んだ)
  外: "そと",     // 外 -> そと (outside)
  暇: "ひま",     // 暇 -> ひま (free time)
  恥: "はず",     // 恥 -> はず (stem for 恥ずかしい, 恥ずかしがる, 恥ずかしがって)
  恥ずかしい: "はずかしい",
  恥ずかしがって: "はずかしがって",
  恥ずかしがる: "はずかしがる",
  入: "はい",     // 入 -> はい (stem for 入る, 入って, 入っていた, 入っている, 入った)
  入っていた: "はいっていた",
  入っている: "はいっている",
  入って: "はいって",
  入る: "はいる",
  気合が入っていた: "きあいがはいっていた",
  気合が入る: "きあいがはいる",
  気合: "きあい",
  焦りもあって: "あせりもあって",
  焦り: "あせり",
  焦る: "あせる",
  もあって: "もあって",
  あって: "あって",
  進: "すす",     // 進 -> すす (stem for 進む, 進める, 進めたい, 進め)
  進めたい: "すすめたい",
  進める: "すすめる",
  進む: "すすむ",
  進め: "すすめ",
  たい: "たい",
  付: "つき",     // 付 -> つき (stem for 付き合い, 付き合う, 付き合っている)
  付き合い: "つきあい",
  付き合う: "つきあう",
  付き合って: "つきあって",
  付き合っている: "つきあっている",
  ろくに: "ろくに",
  陸に: "ろくに",
  できなかった: "できなかった",
  なかった: "なかった",
  できない: "できない",
  できる: "できる",
  できた: "できた",
  はずだ: "はずだ",
  はず: "はず",
  事故: "じこ",
  起きた: "おきた",
  起きる: "おきる",
  兄さん: "にいさん",
  お兄さん: "おにいさん",
  母さん: "かあさん",
  お母さん: "おかあさん",
  忙しい: "いそがしい",
  私: "わたし",
  私が: "わたしが",
  俺: "おれ",
  俺が: "おれが",
  俺は: "おれは",
  俺の: "おれの",
  俺を: "おれを",
  俺に: "おれに",
  僕: "ぼく",
  僕が: "ぼくが",
  日: "ひ",
  水: "みず",
  木: "き",
  金: "かね",
  土: "つち",
  山: "やま",
  川: "かわ",
  空: "そら",
  雨: "あめ",
  手: "て",
  目: "め",
  口: "くち",
  耳: "みみ",
  足: "あし",
  心: "こころ",
};

function calculateTermScore(term: ServerTerm): number {
  let score = getDictPriority(term.dictName) * 1000;

  // Primary reading map guarantee (+5000 bonus / -1000 penalty)
  if (PRIMARY_READING_MAP[term.expression]) {
    const primary = PRIMARY_READING_MAP[term.expression];
    if (term.reading === primary) {
      score += 5000;
    } else if (term.reading.length < primary.length) {
      score -= 1000;
    }
  }
  
  if (typeof term.score === "number") {
    score += term.score * 10;
  }

  const tagsStr = (term.tags || []).join(" ").toLowerCase();
  if (tagsStr.includes("p") || tagsStr.includes("common") || tagsStr.includes("jlpt") || /n[1-5]/.test(tagsStr)) {
    score += 500;
  }
  if (term.jlpt) {
    score += 300;
  }

  // Single Kanji Heuristic: favor standard 2+ character readings (e.g. おとこ over お for 男, おんな over め for 女)
  if (term.expression && term.expression.length === 1 && /[\u4e00-\u9faf]/.test(term.expression)) {
    if (term.reading && term.reading.length >= 2) {
      score += 200;
    }
  }

  return score;
}

// Core Fallback Dictionary Data
const CORE_FALLBACKS: Record<string, ServerTerm[]> = {
  俺が: [
    { dictName: "JIDict (Indonesian)", expression: "俺が", reading: "おれが", meanings: ["Aku / saya (subjek - pronoun 俺 + partikel が)"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "俺が", reading: "おれ发", meanings: ["I (subject - pronoun 俺 + particle が)"], jlpt: "N3", tags: ["P"] },
  ],
  俺は: [
    { dictName: "JIDict (Indonesian)", expression: "俺は", reading: "おれは", meanings: ["Aku / saya (topik - pronoun 俺 + partikel は)"], jlpt: "N3", tags: ["P"] },
  ],
  俺の: [
    { dictName: "JIDict (Indonesian)", expression: "俺の", reading: "おれの", meanings: ["Milikku / aku punya (pronoun 俺 + partikel の)"], jlpt: "N3", tags: ["P"] },
  ],
  俺を: [
    { dictName: "JIDict (Indonesian)", expression: "俺を", reading: "おれを", meanings: ["Aku (objek - pronoun 俺 + partikel を)"], jlpt: "N3", tags: ["P"] },
  ],
  俺に: [
    { dictName: "JIDict (Indonesian)", expression: "俺に", reading: "おれに", meanings: ["Kepadaku / padaku (pronoun 俺 + partikel に)"], jlpt: "N3", tags: ["P"] },
  ],
  できなかった: [
    { dictName: "JIDict (Indonesian)", expression: "できなかった", reading: "できなかった", meanings: ["Tidak bisa; tidak sanggup; tidak mampu (bentuk lampau negatif dari できる)"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "できなかった", reading: "できなかった", meanings: ["could not do; was unable to do (past negative of できる)"], jlpt: "N5", tags: ["P"] },
  ],
  なかった: [
    { dictName: "JIDict (Indonesian)", expression: "なかった", reading: "なかった", meanings: ["Tidak ada; tidak (bentuk lampau negatif dari ない / ある)"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "なかった", reading: "なかった", meanings: ["was not; did not exist (past negative of ない)"], jlpt: "N5", tags: ["P"] },
  ],
  できない: [
    { dictName: "JIDict (Indonesian)", expression: "できない", reading: "できない", meanings: ["Tidak bisa; tidak sanggup; tidak mampu"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "できない", reading: "できない", meanings: ["cannot do; unable to do"], jlpt: "N5", tags: ["P"] },
  ],
  できた: [
    { dictName: "JIDict (Indonesian)", expression: "できた", reading: "できた", meanings: ["Bisa; sanggup; berhasil; selesai (bentuk lampau dari できる)"], jlpt: "N5", tags: ["P"] },
  ],
  できる: [
    { dictName: "JIDict (Indonesian)", expression: "できる", reading: "できる", meanings: ["Bisa; sanggup; mampu; dapat"], jlpt: "N5", tags: ["P"] },
  ],
  はずだ: [
    { dictName: "JIDict (Indonesian)", expression: "はずだ", reading: "はずだ", meanings: ["Seharusnya; semestinya; pasti (ekspresi keyakinan)"], jlpt: "N3", tags: ["P"] },
  ],
  はず: [
    { dictName: "JIDict (Indonesian)", expression: "はず", reading: "はず", meanings: ["Seharusnya; semestinya; dugaan kuat"], jlpt: "N3", tags: ["P"] },
  ],
  ろくに: [
    { dictName: "JIDict (Indonesian)", expression: "ろくに", reading: "ろくに", meanings: ["Dengan baik; dengan benar; dengan selayaknya; dengan memadai (biasa digunakan bersama kalimat negatif / ない / できない)", "Hampir tidak... (dengan baik/benar)"], jlpt: "N2", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "ろくに", reading: "ろくに", meanings: ["properly; well; satisfactorily; decently (with negative verb: hardly; barely)"], jlpt: "N2", tags: ["P"] },
  ],
  陸に: [
    { dictName: "JIDict (Indonesian)", expression: "陸に", reading: "ろくに", meanings: ["Dengan baik; dengan benar; dengan selayaknya (biasa ditulis ろくに)"], jlpt: "N2", tags: ["P"] },
  ],
  付き合い: [
    { dictName: "JIDict (Indonesian)", expression: "付き合い", reading: "つきあい", meanings: ["Pacaran; berpacaran; hubungan romantis; berkencan; hubungan kekasih", "Pergaulan; hubungan sosial; pertemanan; keakraban"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "付き合い", reading: "つきあい", meanings: ["dating; romantic relationship; going out", "association; social relations; friendship"], jlpt: "N3", tags: ["P"] },
  ],
  付き合う: [
    { dictName: "JIDict (Indonesian)", expression: "付き合う", reading: "つきあう", meanings: ["Berpacaran; pacaran; berkencan; jadian (dengan seseorang)", "Bergaul; berteman; menemani"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "付き合う", reading: "つきあう", meanings: ["to date; to go out with; to be in a relationship", "to associate with; to keep company with"], jlpt: "N3", tags: ["P"] },
  ],
  付き合って: [
    { dictName: "JIDict (Indonesian)", expression: "付き合って", reading: "つきあって", meanings: ["Berpacaran; pacaran; jadian; menemani (bentuk te dari 付き合う)"], jlpt: "N3", tags: ["P"] },
  ],
  付き合っている: [
    { dictName: "JIDict (Indonesian)", expression: "付き合っている", reading: "つきあっている", meanings: ["Sedang berpacaran; pacaran; jadian; menjalin hubungan romantis"], jlpt: "N3", tags: ["P"] },
  ],
  進めたい: [
    { dictName: "JIDict (Indonesian)", expression: "進めたい", reading: "すすめたい", meanings: ["Ingin memajukan; ingin melangkah maju; berkeinginan untuk meneruskan/mengembangkan (bentuk 〜たい dari 進める)"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "進めたい", reading: "すすめたい", meanings: ["want to advance; want to move forward; want to push ahead (tai-form of 進める)"], jlpt: "N3", tags: ["P"] },
  ],
  進める: [
    { dictName: "JIDict (Indonesian)", expression: "進める", reading: "すすめる", meanings: ["Memajukan; menggerakkan ke depan; meneruskan; memajukan hubungan/rencana"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "進める", reading: "すすめる", meanings: ["to advance; to promote; to push forward; to speed up"], jlpt: "N3", tags: ["P"] },
  ],
  進む: [
    { dictName: "JIDict (Indonesian)", expression: "進む", reading: "すすむ", meanings: ["Maju; melangkah maju; bergerak ke depan; berkembang"], jlpt: "N4", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "進む", reading: "すすむ", meanings: ["to advance; to go forward; to make progress"], jlpt: "N4", tags: ["P"] },
  ],
  進め: [
    { dictName: "JIDict (Indonesian)", expression: "進め", reading: "すすめ", meanings: ["Maju; teruskan (bentuk perintah / stem dari 進める)"], jlpt: "N3", tags: ["P"] },
  ],
  たい: [
    { dictName: "JIDict (Indonesian)", expression: "たい", reading: "たい", meanings: ["Ingin...; berkeinginan untuk... (akhiran pembentuk kata sifat keinginan dari bentuk-Masu verba)"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "たい", reading: "たい", meanings: ["want to (suffix indicating desire/wanting to do something)"], jlpt: "N5", tags: ["P"] },
  ],
  あって: [
    { dictName: "JIDict (Indonesian)", expression: "あって", reading: "あって", meanings: ["Karena ada...; dikarenakan ada...; mengingat adanya... (Bentuk-te dari ある / 有る yang menyatakan alasan/sebab)", "Ada; berada; wujud (bentuk-te sambung dari ある)"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "あって", reading: "あって", meanings: ["because of; due to the presence of; having... (te-form of ある used as causal conjunction)", "being; existing (te-form of ある)"], jlpt: "N5", tags: ["P"] },
  ],
  もあって: [
    { dictName: "JIDict (Indonesian)", expression: "もあって", reading: "もあって", meanings: ["Juga karena...; sebagian dikarenakan...; di samping alasan lain dikarenakan... (ekspresi gabungan partikel も + あって)"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "もあって", reading: "もあって", meanings: ["partly because of; partly due to; also because..."], jlpt: "N3", tags: ["P"] },
  ],
  焦りもあって: [
    { dictName: "JIDict (Indonesian)", expression: "焦りもあって", reading: "あせりもあって", meanings: ["Juga karena adanya rasa cemas / terburu-buru; dikarenakan rasa cemas"], jlpt: "N3", tags: ["P"] },
  ],
  焦り: [
    { dictName: "JIDict (Indonesian)", expression: "焦り", reading: "あせり", meanings: ["Kecemasan; kegelisahan; ketergesa-gesaan; rasa terburu-buru; rasa tidak sabar"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "焦り", reading: "あせり", meanings: ["impatience; anxiety; restlessness"], jlpt: "N3", tags: ["P"] },
  ],
  焦る: [
    { dictName: "JIDict (Indonesian)", expression: "焦る", reading: "あせる", meanings: ["Merasa cemas; terburu-buru; gelisah; panik; hilang kesabaran"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "焦る", reading: "あせる", meanings: ["to be in a hurry; to be impatient; to feel anxious; to panic"], jlpt: "N3", tags: ["P"] },
  ],
  入っていた: [
    { dictName: "JIDict (Indonesian)", expression: "入っていた", reading: "はいっていた", meanings: ["Telah masuk; berada di dalam; dipenuhi (bentuk lampau berkelanjutan 〜ていた dari 入る)", "(mis. 気合が入っていた) Sangat bersemangat; dipenuhi rasa antusiasme"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "入っていた", reading: "はいっていた", meanings: ["was inside; was contained in; was full of (past continuous of 入る)"], jlpt: "N5", tags: ["P"] },
  ],
  入っている: [
    { dictName: "JIDict (Indonesian)", expression: "入っている", reading: "はいっている", meanings: ["Sedang berada di dalam; terkandung; dipenuhi (bentuk 〜ている dari 入る)"], jlpt: "N5", tags: ["P"] },
  ],
  入って: [
    { dictName: "JIDict (Indonesian)", expression: "入って", reading: "はいって", meanings: ["Masuk; masuklah (bentuk te dari 入る)"], jlpt: "N5", tags: ["P"] },
  ],
  気合が入っていた: [
    { dictName: "JIDict (Indonesian)", expression: "気合が入っていた", reading: "きあいがはいっていた", meanings: ["Sangat bersemangat; dipenuhi rasa antusiasme; tampil penuh totalitas & energi"], jlpt: "N3", tags: ["P"] },
  ],
  気合が入る: [
    { dictName: "JIDict (Indonesian)", expression: "気合が入る", reading: "きあいがはいる", meanings: ["Penuh semangat; bersemangat tinggi; sangat antusias; siap totalitas"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "気合が入る", reading: "きあいがはいる", meanings: ["to be fired up; to be full of motivation/enthusiasm; to put one's heart into"], jlpt: "N3", tags: ["P"] },
  ],
  気合: [
    { dictName: "JIDict (Indonesian)", expression: "気合", reading: "きあい", meanings: ["Semangat; dorongan energi; antusiasme; fokus mental; kecenderungan jiwa"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "気合", reading: "きあい", meanings: ["fighting spirit; motivation; enthusiasm; drive"], jlpt: "N3", tags: ["P"] },
  ],
  恥ずかしがって: [
    { dictName: "JIDict (Indonesian)", expression: "恥ずかしがって", reading: "はずかしがって", meanings: ["Merasa malu; malu-malu; canggung (bentuk te dari 恥ずかしがる)"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "恥ずかしがって", reading: "はずかしがって", meanings: ["being shy; feeling embarrassed"], jlpt: "N3", tags: ["P"] },
  ],
  恥ずかしい: [
    { dictName: "JIDict (Indonesian)", expression: "恥ずかしい", reading: "はずかしい", meanings: ["Malu; segan; canggung"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "恥ずかしい", reading: "はずかしい", meanings: ["embarrassed; shy; ashamed"], jlpt: "N5", tags: ["P"] },
  ],
  恥: [
    { dictName: "JIDict (Indonesian)", expression: "恥", reading: "はじ", meanings: ["Rasa malu; aib; cacat nama"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "恥", reading: "はじ", meanings: ["shame; embarrassment; disgrace"], jlpt: "N3", tags: ["P"] },
  ],
  セミ: [
    { dictName: "JIDict (Indonesian)", expression: "セミ", reading: "セミ", meanings: ["Tonggeret; jangkrik pohon; serangga cicada (蝉)"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "セミ", reading: "セミ", meanings: ["cicada (insect)"], jlpt: "N3", tags: ["P"] },
  ],
  蝉: [
    { dictName: "JIDict (Indonesian)", expression: "蝉", reading: "セミ", meanings: ["Tonggeret; jangkrik pohon; serangga cicada"], jlpt: "N3", tags: ["P"] },
  ],
  外: [
    { dictName: "JIDict (Indonesian)", expression: "外", reading: "そと", meanings: ["Luar; bagian luar; di luar rumah"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "外", reading: "そと", meanings: ["outside; exterior"], jlpt: "N5", tags: ["P"] },
  ],
  外に出る: [
    { dictName: "JIDict (Indonesian)", expression: "外に出る", reading: "そとにでる", meanings: ["Pergi ke luar; keluar rumah"], jlpt: "N5", tags: ["P"] },
  ],
  暇: [
    { dictName: "JIDict (Indonesian)", expression: "暇", reading: "ひま", meanings: ["Waktu luang; senggang; tidak sibuk"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "暇", reading: "ひま", meanings: ["free time; spare time; leisure"], jlpt: "N5", tags: ["P"] },
  ],
  事故: [
    { dictName: "JIDict (Indonesian)", expression: "事故", reading: "じこ", meanings: ["Kecelakaan; insiden; musibah"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "事故", reading: "じこ", meanings: ["accident; incident; trouble"], jlpt: "N3", tags: ["P"] },
  ],
  起きた: [
    { dictName: "JIDict (Indonesian)", expression: "起きた", reading: "おきた", meanings: ["Terjadi; bangun (bentuk ta dari 起きる)"], jlpt: "N5", tags: ["P"] },
  ],
  起きる: [
    { dictName: "JIDict (Indonesian)", expression: "起きる", reading: "おきる", meanings: ["Bangun; terjadi; timbul"], jlpt: "N5", tags: ["P"] },
  ],
  飲んで: [
    { dictName: "JIDict (Indonesian)", expression: "飲んで", reading: "のんで", meanings: ["Minum (bentuk te dari 飲む)"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "飲んで", reading: "のんで", meanings: ["drinking (te-form of 飲む)"], jlpt: "N5", tags: ["P"] },
  ],
  飲んだ: [
    { dictName: "JIDict (Indonesian)", expression: "飲んだ", reading: "のんだ", meanings: ["Meminum (bentuk ta dari 飲む)"], jlpt: "N5", tags: ["P"] },
  ],
  飲む: [
    { dictName: "JIDict (Indonesian)", expression: "飲む", reading: "のむ", meanings: ["Minum; menelan"], jlpt: "N5", tags: ["P"] },
  ],
  兄さん: [
    { dictName: "JIDict (Indonesian)", expression: "兄さん", reading: "にいさん", meanings: ["Kakak laki-laki"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "兄さん", reading: "にいさん", meanings: ["older brother; elder brother"], jlpt: "N5", tags: ["P"] },
  ],
  お兄さん: [
    { dictName: "JIDict (Indonesian)", expression: "お兄さん", reading: "おにいさん", meanings: ["Kakak laki-laki"], jlpt: "N5", tags: ["P"] },
  ],
  母さん: [
    { dictName: "JIDict (Indonesian)", expression: "母さん", reading: "かあさん", meanings: ["Ibu; mama"], jlpt: "N5", tags: ["P"] },
  ],
  お母さん: [
    { dictName: "JIDict (Indonesian)", expression: "お母さん", reading: "おかあさん", meanings: ["Ibu; mama"], jlpt: "N5", tags: ["P"] },
  ],
  忙しい: [
    { dictName: "JIDict (Indonesian)", expression: "忙しい", reading: "いそがしい", meanings: ["Sibuk; banyak pekerjaan"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "忙しい", reading: "いそがしい", meanings: ["busy; occupied"], jlpt: "N5", tags: ["P"] },
  ],
  告げずに: [
    { dictName: "JIDict (Indonesian)", expression: "告げずに", reading: "つげずに", meanings: ["Tanpa memberitahu/berkata"], jlpt: "N3", tags: ["P"] },
  ],
  告げず: [
    { dictName: "JIDict (Indonesian)", expression: "告げず", reading: "つげず", meanings: ["Tanpa memberitahu"], jlpt: "N3", tags: ["P"] },
  ],
  告げる: [
    { dictName: "JIDict (Indonesian)", expression: "告げる", reading: "つげる", meanings: ["Memberitahukan; menyampaikan; mengumumkan"], jlpt: "N3", tags: ["P"] },
  ],
  出た: [
    { dictName: "JIDict (Indonesian)", expression: "出た", reading: "でた", meanings: ["Keluar; meninggalkan (bentuk lampau dari 出る)"], jlpt: "N5", tags: ["P"] },
  ],
  出る: [
    { dictName: "JIDict (Indonesian)", expression: "出る", reading: "でる", meanings: ["Keluar; muncul"], jlpt: "N5", tags: ["P"] },
  ],
  家: [
    { dictName: "JIDict (Indonesian)", expression: "家", reading: "いえ", meanings: ["Rumah; tempat tinggal"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "家", reading: "いえ", meanings: ["house; home; dwelling"], jlpt: "N5", tags: ["P"] },
  ],
  誰にも: [
    { dictName: "JIDict (Indonesian)", expression: "誰にも", reading: "だれにも", meanings: ["Kepada siapa pun (dengan kalimat negatif)"], jlpt: "N5", tags: ["P"] },
  ],
  チャラ男: [
    { dictName: "JIDict (Indonesian)", expression: "チャラ男", reading: "チャラおとこ", meanings: ["Chara-otoko (pria gaul/flirty man)"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "チャラ男", reading: "チャラおとこ", meanings: ["playboy, shallow man who dresses flashily"], tags: ["P"] },
  ],
  男: [
    { dictName: "JIDict (Indonesian)", expression: "男", reading: "おとこ", meanings: ["Laki-laki; pria; gagah"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "男", reading: "おとこ", meanings: ["man; male"], jlpt: "N5", tags: ["P"] },
  ],
  女: [
    { dictName: "JIDict (Indonesian)", expression: "女", reading: "おんな", meanings: ["Perempuan; wanita"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "女", reading: "おんな", meanings: ["woman; female"], jlpt: "N5", tags: ["P"] },
  ],
  子: [
    { dictName: "JIDict (Indonesian)", expression: "子", reading: "こ", meanings: ["Anak; bocah"], jlpt: "N5", tags: ["P"] },
  ],
  人: [
    { dictName: "JIDict (Indonesian)", expression: "人", reading: "ひと", meanings: ["Orang; manusia"], jlpt: "N5", tags: ["P"] },
  ],
  言: [
    { dictName: "JIDict (Indonesian)", expression: "言", reading: "い", meanings: ["Bicara; kata (stems: 言う, 言っている, 言った)"], jlpt: "N5", tags: ["P"] },
  ],
  美雪: [
    { dictName: "JIDict (Indonesian)", expression: "美雪", reading: "みゆき", meanings: ["Miyuki (nama perempuan / salju indah)"], jlpt: "N5", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "美雪", reading: "みゆき", meanings: ["Miyuki (female given name / beautiful snow)"], tags: ["P"] },
  ],
  美: [
    { dictName: "JIDict (Indonesian)", expression: "美", reading: "み", meanings: ["Cantik; indah; agung"], jlpt: "N3", tags: ["P"] },
    { dictName: "Jitendex (English)", expression: "美", reading: "び", meanings: ["beauty"], tags: ["P"] },
  ],
  はぁ: [
    { dictName: "JIDict (Indonesian)", expression: "はぁ", reading: "はぁ", meanings: ["Haa... (desah/helan napas, seruan terkejut/bingung)"], jlpt: "N5" },
    { dictName: "Jitendex (English)", expression: "はぁ", reading: "haa", meanings: ["sigh, gasp, expression of surprise or exasperation"] },
  ],
  はあ: [
    { dictName: "JIDict (Indonesian)", expression: "はあ", reading: "はあ", meanings: ["Haa... (desah/helan napas, ya/tentu)"], jlpt: "N5" },
  ],
  ふぅ: [
    { dictName: "JIDict (Indonesian)", expression: "ふぅ", reading: "ふぅ", meanings: ["Fuu... (helan napas lega/lelah)"] },
  ],
  へぇ: [
    { dictName: "JIDict (Indonesian)", expression: "へぇ", reading: "へぇ", meanings: ["Hee... (seruan kagum/heran/terkejut)"] },
  ],
  そんな: [
    { dictName: "JIDict (Indonesian)", expression: "そんな", reading: "そんな", meanings: ["Seperti itu, yang seperti itu"], jlpt: "N5" },
    { dictName: "Jitendex (English)", expression: "そんな", reading: "そんな", meanings: ["such, that sort of, like that"], jlpt: "N5" },
  ],
  お前: [
    { dictName: "JIDict (Indonesian)", expression: "お前", reading: "おまえ", meanings: ["Kamu, kau (informal / agak kasar)", "Engkau"], jlpt: "N5" },
    { dictName: "Jitendex (English)", expression: "お前", reading: "おまえ", meanings: ["You (informal or familiar male speech)", "Presence (of a high-ranking person)"], jlpt: "N5" },
  ],
  今日は: [
    { dictName: "JIDict (Indonesian)", expression: "今日は", reading: "きょうは", meanings: ["Hari ini (sebagai topik pembicaraan)"], jlpt: "N5" },
  ],
  今日: [
    { dictName: "JIDict (Indonesian)", expression: "今日", reading: "きょう", meanings: ["Hari ini"], jlpt: "N5" },
  ],
  浮気: [
    { dictName: "JIDict (Indonesian)", expression: "浮気", reading: "うわき", meanings: ["Perselingkuhan, kecurangan"], jlpt: "N2" },
  ],
  発覚: [
    { dictName: "JIDict (Indonesian)", expression: "発覚", reading: "はっかく", meanings: ["Terbongkar, terungkapnya rahasia/kejahatan"], jlpt: "N1" },
  ],
  いじめ: [
    { dictName: "JIDict (Indonesian)", expression: "いじめ", reading: "いじめ", meanings: ["Perundungan, pembulian"], jlpt: "N2" },
  ],
  私: [
    { dictName: "JIDict (Indonesian)", expression: "私", reading: "わたし", meanings: ["Saya, aku"], jlpt: "N5" },
  ],
  俺: [
    { dictName: "JIDict (Indonesian)", expression: "俺", reading: "おれ", meanings: ["Aku (laki-laki informal)"], jlpt: "N3" },
  ],
  僕: [
    { dictName: "JIDict (Indonesian)", expression: "僕", reading: "ぼく", meanings: ["Aku (laki-laki)"], jlpt: "N5" },
  ],
  学校: [
    { dictName: "JIDict (Indonesian)", expression: "学校", reading: "がっこう", meanings: ["Sekolah"], jlpt: "N5" },
  ],
};

const CORE_KANJI_FALLBACKS: Record<string, ServerKanji> = {
  男: { kanji: "男", onyomi: ["ダン", "ナン"], kunyomi: ["おとこ"], meanings: ["Laki-laki, pria", "Man, male"] },
  女: { kanji: "女", onyomi: ["ジョ", "ニョ"], kunyomi: ["おんな"], meanings: ["Wanita, perempuan", "Woman, female"] },
  前: { kanji: "前", onyomi: ["ゼン"], kunyomi: ["まえ"], meanings: ["Depan, sebelum, terdahulu", "In front, before"] },
  今: { kanji: "今", onyomi: ["コン", "キン"], kunyomi: ["いま"], meanings: ["Sekarang, saat ini", "Now, present"] },
  日: { kanji: "日", onyomi: ["ニチ", "ジツ"], kunyomi: ["ひ", "か"], meanings: ["Hari, matahari", "Day, sun"] },
  浮: { kanji: "浮", onyomi: ["フ"], kunyomi: ["う-く"], meanings: ["Mengapung, melayang", "Float, rise"] },
  気: { kanji: "気", onyomi: ["キ", "ケ"], kunyomi: ["き"], meanings: ["Perasaan, pikiran, udara", "Spirit, mind"] },
  発: { kanji: "発", onyomi: ["ハツ", "ホツ"], kunyomi: ["たつ"], meanings: ["Menerbitkan, terbongkar", "Discharge, emit"] },
  覚: { kanji: "覚", onyomi: ["カク"], kunyomi: ["おぼ-える"], meanings: ["Mengingat, sadar", "Memorize, awake"] },
  学: { kanji: "学", onyomi: ["ガク"], kunyomi: ["まな-ぶ"], meanings: ["Belajar, ilmu", "Study, learn"] },
  校: { kanji: "校", onyomi: ["コウ"], kunyomi: [], meanings: ["Sekolah", "School"] },
  私: { kanji: "私", onyomi: ["シ"], kunyomi: ["わたし", "わたくし"], meanings: ["Saya, aku, pribadi", "I, me, private"] },
  俺: { kanji: "俺", onyomi: ["エン"], kunyomi: ["おれ"], meanings: ["Aku (laki-laki informal)", "I, me"] },
  僕: { kanji: "僕", onyomi: ["ボク"], kunyomi: ["しもべ"], meanings: ["Aku (laki-laki)", "I, me, servant"] },
  人: { kanji: "人", onyomi: ["ジン", "ニン"], kunyomi: ["ひと"], meanings: ["Orang, manusia", "Person, human"] },
  生: { kanji: "生", onyomi: ["セイ", "ショウ"], kunyomi: ["い-きる", "う-まれる", "なま"], meanings: ["Hidup, lahir, mentah", "Life, birth"] },
  行: { kanji: "行", onyomi: ["コウ", "ギョウ"], kunyomi: ["い-く", "おこな-う"], meanings: ["Pergi, melakukan", "Go, conduct"] },
  見: { kanji: "見", onyomi: ["ケン"], kunyomi: ["み-る"], meanings: ["Melihat, tampak", "See, look"] },
  言: { kanji: "言", onyomi: ["ゲン", "ゴン"], kunyomi: ["い-う", "こと"], meanings: ["Bicara, kata", "Say, word"] },
  心: { kanji: "心", onyomi: ["シン"], kunyomi: ["こころ"], meanings: ["Hati, pikiran, perasaan", "Heart, mind"] },
  数: { kanji: "数", onyomi: ["スウ", "ス"], kunyomi: ["かず", "かぞ-える"], meanings: ["Angka, jumlah, hitungan", "Number, count"] },
  年: { kanji: "年", onyomi: ["ネン"], kunyomi: ["とし"], meanings: ["Tahun, usia", "Year, age"] },
  事: { kanji: "事", onyomi: ["ジ", "ズ"], kunyomi: ["こと"], meanings: ["Hal, perkara, kejadian", "Thing, matter, incident"] },
  故: { kanji: "故", onyomi: ["コ"], kunyomi: ["ゆえ"], meanings: ["Alasan, sebab, almarhum", "Reason, cause, deceased"] },
  起: { kanji: "起", onyomi: ["キ"], kunyomi: ["お-きる", "お-こる"], meanings: ["Bangun, terjadi", "Rouse, wake up, occur"] },
  特: { kanji: "特", onyomi: ["トク"], kunyomi: [], meanings: ["Khusus, istimewa", "Special"] },
  集: { kanji: "集", onyomi: ["シュウ"], kunyomi: ["あつ-まる", "あつ-める"], meanings: ["Kumpul, himpun", "Gather, collect"] },
  報: { kanji: "報", onyomi: ["ホウ"], kunyomi: ["むく-いる"], meanings: ["Laporan, kabar, warta", "Report, news, reward"] },
  道: { kanji: "道", onyomi: ["ドウ", "トウ"], kunyomi: ["みち"], meanings: ["Jalan, cara", "Road, way, path"] },
  飲: { kanji: "飲", onyomi: ["イン"], kunyomi: ["の-む"], meanings: ["Minum", "Drink"] },
  恥: { kanji: "恥", onyomi: ["チ"], kunyomi: ["はじ", "はず-かしい"], meanings: ["Malu, aib", "Shame, embarrassment"] },
  付: { kanji: "付", onyomi: ["フ"], kunyomi: ["つ-ける", "つ-く"], meanings: ["Menempel, menyertai, pacaran, berhubungan", "Attach, adhere, date"] },
};

function initCoreFallbacks() {
  for (const [expr, terms] of Object.entries(CORE_FALLBACKS)) {
    const existing = termMap.get(expr) || [];
    const filteredExisting = existing.filter(
      (t) => !terms.some((c) => c.reading === t.reading && c.dictName === t.dictName)
    );
    const combined = [...terms, ...filteredExisting];
    combined.sort((a, b) => calculateTermScore(b) - calculateTermScore(a));
    termMap.set(expr, combined);
  }
  for (const [k, obj] of Object.entries(CORE_KANJI_FALLBACKS)) {
    if (!kanjiMap.has(k)) kanjiMap.set(k, obj);
  }
}

const CACHE_FILES = [
  path.join(process.cwd(), "src", "data", "dict-cache-v1.json"),
  path.join(process.cwd(), "public", "dict-cache-v1.json"),
  path.join(process.cwd(), ".next", "dict-cache-v1.json"),
];

async function buildServerIndexInBackground() {
  if (isIndexReady || isIndexBuilding) return;
  isIndexBuilding = true;

  // Try loading pre-built disk cache (< 10ms instant load on refresh)
  try {
    for (const cacheFile of CACHE_FILES) {
      if (fs.existsSync(cacheFile)) {
        const cachedData = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
        if (cachedData.terms && cachedData.terms.length > 0) {
          for (const [k, v] of cachedData.terms) {
            termMap.set(k, v);
          }
          for (const [k, v] of cachedData.kanji) {
            kanjiMap.set(k, v);
          }
          isIndexReady = true;
          isIndexBuilding = false;
          return;
        }
      }
    }
  } catch (err) {
    console.warn("Could not load dict disk cache:", err);
  }

  initCoreFallbacks();

  let refDir = path.join(process.cwd(), "reference", "kotoba-rumus");
  if (!fs.existsSync(refDir)) {
    refDir = path.join(process.cwd(), "reference");
  }

  if (!fs.existsSync(refDir)) {
    isIndexReady = true;
    isIndexBuilding = false;
    return;
  }

  try {
    const files = fs.readdirSync(refDir).filter((f) => {
      const lower = f.toLowerCase();
      return lower.endsWith(".zip") && !lower.includes("素材辞典");
    });

    await Promise.all(
      files.map(async (filename) => {
        try {
          const filePath = path.join(refDir, filename);
          const buffer = fs.readFileSync(filePath);
          const zip = new JSZip();
          const contents = await zip.loadAsync(buffer);

          let dictTitle = filename.replace(/\.zip$/i, "");
          const indexFile = contents.file("index.json");
          if (indexFile) {
            try {
              const indexText = await indexFile.async("string");
              const indexJson = JSON.parse(indexText);
              if (indexJson.title) dictTitle = indexJson.title;
            } catch {}
          }

          const termFiles = Object.keys(contents.files).filter((name) =>
            /term_bank_\d+\.json$/i.test(name) || /term_meta_bank_\d+\.json$/i.test(name)
          );

          await Promise.all(
            termFiles.map(async (tf) => {
              const fileObj = contents.file(tf);
              if (!fileObj) return;
              const text = await fileObj.async("string");
              const entries = JSON.parse(text);

              for (const entry of entries) {
                if (Array.isArray(entry) && entry.length >= 6) {
                  const expression = String(entry[0] || "");
                  const reading = String(entry[1] || "");
                  const rawMeanings = entry[5];

                  let meanings: string[] = [];
                  if (Array.isArray(rawMeanings)) {
                    meanings = rawMeanings.map(cleanMeaningString).filter(Boolean);
                  } else if (rawMeanings) {
                    const cleaned = cleanMeaningString(rawMeanings);
                    if (cleaned) meanings = [cleaned];
                  }

                  if (expression && meanings.length > 0) {
                    const rawScore = typeof entry[4] === "number" ? entry[4] : 0;
                    const defTags = typeof entry[2] === "string" ? [entry[2]] : [];
                    const termTags = typeof entry[7] === "string" ? [entry[7]] : [];
                    const allTags = Array.from(new Set([...defTags, ...termTags].filter(Boolean)));

                    const termObj: ServerTerm = {
                      dictName: dictTitle,
                      expression,
                      reading: reading || expression,
                      meanings,
                      tags: allTags,
                      score: rawScore,
                    };

                    const existing = termMap.get(expression) || [];
                    existing.push(termObj);
                    termMap.set(expression, existing);
                  }
                }
              }
            })
          );

          const kanjiFiles = Object.keys(contents.files).filter((name) =>
            /kanji_bank_\d+\.json$/i.test(name)
          );

          await Promise.all(
            kanjiFiles.map(async (kf) => {
              const fileObj = contents.file(kf);
              if (!fileObj) return;
              const text = await fileObj.async("string");
              const entries = JSON.parse(text);

              for (const entry of entries) {
                if (Array.isArray(entry) && entry.length >= 5) {
                  const kanji = String(entry[0] || "");
                  const onyomi = typeof entry[1] === "string" ? entry[1].split(/\s+/) : [];
                  const kunyomi = typeof entry[2] === "string" ? entry[2].split(/\s+/) : [];
                  const meanings = Array.isArray(entry[4])
                    ? entry[4].map(cleanMeaningString).filter(Boolean)
                    : [cleanMeaningString(entry[4])].filter(Boolean);

                  if (kanji) {
                    kanjiMap.set(kanji, { kanji, onyomi, kunyomi, meanings });
                  }
                }
              }
            })
          );
        } catch (err) {
          console.warn(`Error indexing server dictionary ${filename}:`, err);
        }
      })
    );

    // Save persistent disk cache for instant loading on future refreshes
    try {
      const targetCacheFile = CACHE_FILES[0];
      const cacheDir = path.dirname(targetCacheFile);
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(
        targetCacheFile,
        JSON.stringify({
          terms: Array.from(termMap.entries()),
          kanji: Array.from(kanjiMap.entries()),
        })
      );
    } catch (e) {
      console.warn("Failed to write dict disk cache:", e);
    }
  } catch (err) {
    console.error("Server dictionary index error:", err);
  }

  isIndexReady = true;
  isIndexBuilding = false;
}

export async function GET(request: Request) {
  initCoreFallbacks();
  if (!isIndexReady && !isIndexBuilding) {
    buildServerIndexInBackground();
  }

  const { searchParams } = new URL(request.url);

  // Status check endpoint for client dictionary readiness indicator
  if (searchParams.has("status")) {
    return NextResponse.json({
      isReady: isIndexReady,
      isBuilding: isIndexBuilding,
      totalTerms: termMap.size,
      totalKanji: kanjiMap.size,
    });
  }

  const q = searchParams.get("q")?.trim() || "";

  const cleanQuery = q.substring(0, 50);

  if (!cleanQuery) {
    return NextResponse.json({
      query: "",
      reading: "",
      terms: [],
      kanjiList: [],
      segmentedWords: [],
    });
  }

  const matchedTerms: ServerTerm[] = [];
  const matchedKanji: ServerKanji[] = [];
  const segmentedWords: any[] = [];
  const termPositionMap = new Map<ServerTerm, number>();

  // Direct Match
  const direct = termMap.get(cleanQuery);
  if (direct && direct.length > 0) {
    for (const d of direct) {
      matchedTerms.push(d);
      termPositionMap.set(d, 0);
    }
  }

  // Word Segmentation
  let cursor = 0;
  let computedReading = "";

  while (cursor < cleanQuery.length) {
    let found = false;
    for (let len = Math.min(10, cleanQuery.length - cursor); len >= 1; len--) {
      const sub = cleanQuery.substring(cursor, cursor + len);
      const rawSubMatches = termMap.get(sub);
      if (rawSubMatches && rawSubMatches.length > 0) {
        // Sort subMatches using comprehensive scoring (dictionary priority + Yomitan score + popularity tags + length heuristics)
        const subMatches = [...rawSubMatches].sort(
          (a, b) => calculateTermScore(b) - calculateTermScore(a)
        );
        const top = subMatches[0];
        segmentedWords.push({
          text: sub,
          reading: top.reading,
          meanings: top.meanings,
          dictName: top.dictName,
        });
        computedReading += top.reading || sub;

        for (const m of subMatches) {
          if (!matchedTerms.some((t) => t.expression === m.expression && t.dictName === m.dictName)) {
            matchedTerms.push(m);
            termPositionMap.set(m, cursor);
          }
        }
        cursor += len;
        found = true;
        break;
      }
    }

    if (!found) {
      const char = cleanQuery[cursor];
      computedReading += char;
      if (/[\u4e00-\u9faf]/.test(char)) {
        const kObj = kanjiMap.get(char);
        if (kObj) {
          segmentedWords.push({ text: char, meanings: kObj.meanings });
        }
      }
      cursor++;
    }
  }

  // Extract Kanji details
  const kanjiChars = Array.from(new Set(cleanQuery.match(/[\u4e00-\u9faf]/g) || []));
  for (const char of kanjiChars) {
    let kObj = kanjiMap.get(char);
    if (!kObj && termMap.has(char)) {
      const terms = termMap.get(char)!;
      const readings = Array.from(new Set(terms.map((t) => t.reading).filter(Boolean)));
      const meanings = Array.from(
        new Set(
          terms
            .flatMap((t) => t.meanings || [])
            .map((m) => cleanMeaningString(m))
            .filter(Boolean)
        )
      );
      const onyomi = readings.filter((r) => /^[\u30a0-\u30ff]+$/.test(r));
      const kunyomi = readings.filter((r) => /^[\u3040-\u309f-]+$/.test(r));
      kObj = {
        kanji: char,
        onyomi,
        kunyomi: kunyomi.length > 0 ? kunyomi : readings,
        meanings: meanings.length > 0 ? meanings : ["Karakter Kanji"],
      };
    }

    if (kObj) {
      matchedKanji.push(kObj);
    } else {
      matchedKanji.push({
        kanji: char,
        onyomi: [],
        kunyomi: [],
        meanings: ["Karakter Kanji"],
      });
    }
  }

  // Sort matched terms:
  // 1. Primary: strictly sequentially by position of appearance in sentence (left-to-right from beginning to end)
  // 2. Secondary: by dictionary priority score for entries at the exact same position
  matchedTerms.sort((a, b) => {
    const posA = termPositionMap.get(a) ?? 999;
    const posB = termPositionMap.get(b) ?? 999;
    if (posA !== posB) {
      return posA - posB;
    }
    return calculateTermScore(b) - calculateTermScore(a);
  });

  const exactTermMatch = matchedTerms.find((t) => t.expression === cleanQuery);
  const finalReading = (exactTermMatch && exactTermMatch.reading)
    ? exactTermMatch.reading
    : (computedReading || cleanQuery);

  return NextResponse.json({
    query: cleanQuery,
    reading: finalReading,
    terms: matchedTerms,
    kanjiList: matchedKanji,
    segmentedWords,
  });
}
