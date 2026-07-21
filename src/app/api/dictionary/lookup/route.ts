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
  jlpt?: string;
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
  の: [
    { dictName: "JIDict (Indonesian)", expression: "の", reading: "の", meanings: ["Partikel kepemilikan (milik / -nya; misal: 私の = milik saya)", "Penghubung kata benda (misal: 日本の車 = mobil Jepang)", "Nominalizer / Pengubah kata kerja & sifat menjadi kata benda"], jlpt: "N5" },
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

const KANJI_JLPT_MAP: Record<string, string> = {
  // N5 Kanji
  "一":"N5","二":"N5","三":"N5","四":"N5","五":"N5","六":"N5","七":"N5","八":"N5","九":"N5","十":"N5",
  "百":"N5","千":"N5","万":"N5","円":"N5","校":"N5","名前":"N5","前":"N5","後":"N5","左":"N5","右":"N5",
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
  // N4 Kanji
  "不":"N4","世":"N4","主":"N4","乗":"N4","事":"N4","仕":"N4","代":"N4","以":"N4","体":"N4","作":"N4",
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
  // N3 Kanji
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
  // N2 Kanji
  "瀬":"N2","猛":"N2","党":"N2","協":"N2","総":"N2","区":"N2","領":"N2","県":"N2","設":"N2","保":"N2","改":"N2","第":"N2",
  "結":"N2","派":"N2","府":"N2","査":"N2","委":"N2","軍":"N2","案":"N2","基":"N2","島":"N2","提":"N2",
  "企":"N2","検":"N2","藤":"N2","沢":"N2","裁":"N2","証":"N2","援":"N2","施":"N2",
  "井":"N2","護":"N2","展":"N2","態":"N2","鮮":"N2","視":"N2","条":"N2","幹":"N2","独":"N2","宮":"N2",
  "率":"N2","衛":"N2","張":"N2","監":"N2","審":"N2","義":"N2","訴":"N2","株":"N2","姿":"N2","閣":"N2",
  "韓":"N2","徴":"N2","題":"N2","罰":"N2","責":"N2","就":"N2","創":"N2","造":"N2",
  // N1 Kanji
  "之":"N1","氏":"N1","民":"N1","関":"N1","論":"N1","術":"N1","築":"N1","憲":"N1","障":"N1"
};

const CORE_KANJI_DICT: Record<string, { onyomi: string[]; kunyomi: string[]; meanings: string[]; jlpt?: string }> = {
  退: { onyomi: ["タイ"], kunyomi: ["しりぞ-く", "のぞ-く"], meanings: ["Mundur, berhenti, keluar dari sekolah/posisi, menyurut"], jlpt: "N3" },
  学: { onyomi: ["ガク"], kunyomi: ["まな-ぶ"], meanings: ["Belajar, ilmu, sekolah, terpelajar"], jlpt: "N5" },
  者: { onyomi: ["シャ"], kunyomi: ["もの"], meanings: ["Orang, individu, pihak, sosok"], jlpt: "N4" },
  出: { onyomi: ["シュツ", "スイ"], kunyomi: ["で-る", "だ-す"], meanings: ["Keluar, mengeluarkan, muncul, terbit"], jlpt: "N5" },
  弁: { onyomi: ["ベン"], kunyomi: ["わきま-える"], meanings: ["Penjelasan, pembelaan, pidato, dialek"], jlpt: "N2" },
  明: { onyomi: ["メイ", "ミョウ"], kunyomi: ["あか-るい", "あき-らか"], meanings: ["Terang, jelas, mengerti, fajar"], jlpt: "N4" },
  述: { onyomi: ["ジュツ"], kunyomi: ["のべ-る"], meanings: ["Menyatakan, mengemukakan, menceritakan"], jlpt: "N3" },
  坂: { onyomi: ["ハン"], kunyomi: ["さか"], meanings: ["Lereng, bukit, tanjakan"], jlpt: "N3" },
  柳: { onyomi: ["リュウ"], kunyomi: ["やなぎ"], meanings: ["Pohon dedalu (willow)"], jlpt: "N1" },
  鬼: { onyomi: ["キ"], kunyomi: ["おに"], meanings: ["Iblis, oni, setan, raksasa"], jlpt: "N2" },
  島: { onyomi: ["トウ"], kunyomi: ["しま"], meanings: ["Pulau"], jlpt: "N4" },
  止: { onyomi: ["シ"], kunyomi: ["と-まる", "と-める"], meanings: ["Berhenti, menghentikan, mencegah"], jlpt: "N4" },
  入: { onyomi: ["ニュウ"], kunyomi: ["はい-る", "い-れる"], meanings: ["Masuk, dimasukkan, dipenuhi"], jlpt: "N5" },
  焦: { onyomi: ["ショウ"], kunyomi: ["あせ-る", "あせ-り"], meanings: ["Cemas, gelisah, terburu-buru, panik"], jlpt: "N3" },
  進: { onyomi: ["シン"], kunyomi: ["すす-む", "すす-める"], meanings: ["Maju, melangkah maju, memajukan"], jlpt: "N3" },
  前: { onyomi: ["ゼン"], kunyomi: ["まえ"], meanings: ["Depan, sebelum, terdahulu"], jlpt: "N5" },
  今: { onyomi: ["コン", "キン"], kunyomi: ["いま"], meanings: ["Sekarang, saat ini"], jlpt: "N5" },
  日: { onyomi: ["ニチ", "ジツ"], kunyomi: ["ひ", "か"], meanings: ["Hari, matahari"], jlpt: "N5" },
  私: { onyomi: ["シ"], kunyomi: ["わたし", "わたくし"], meanings: ["Saya, aku, pribadi"], jlpt: "N5" },
  俺: { onyomi: ["エン"], kunyomi: ["おれ"], meanings: ["Aku (laki-laki informal)"], jlpt: "N3" },
  僕: { onyomi: ["ボク"], kunyomi: ["しもべ"], meanings: ["Aku (laki-laki)"], jlpt: "N5" },
  人: { onyomi: ["ジン", "ニン"], kunyomi: ["ひと"], meanings: ["Orang, manusia"], jlpt: "N5" },
  生: { onyomi: ["セイ", "ショウ"], kunyomi: ["い-きる", "う-まれる", "なま"], meanings: ["Hidup, lahir, mentah"], jlpt: "N5" },
  美: { onyomi: ["ビ", "ミ"], kunyomi: ["うつく-しい"], meanings: ["Cantik, indah, keindahan"], jlpt: "N3" },
  雪: { onyomi: ["セツ"], kunyomi: ["ゆき"], meanings: ["Salju"], jlpt: "N3" },
  校: { onyomi: ["コウ"], kunyomi: [], meanings: ["Sekolah"], jlpt: "N5" },
  年: { onyomi: ["ネン"], kunyomi: ["とし"], meanings: ["Tahun, usia"], jlpt: "N5" },
  去: { onyomi: ["キョ", "コ"], kunyomi: ["さ-る"], meanings: ["Lalu, pergi, meninggalkan"], jlpt: "N4" },
  暑: { onyomi: ["ショ"], kunyomi: ["あつ-い"], meanings: ["Panas (cuaca)"], jlpt: "N3" },
  猛: { onyomi: ["モウ"], kunyomi: ["たけ-ぶ"], meanings: ["Sangat, sengit, ganas, keras"], jlpt: "N2" },
};

  // Extract Kanji details
  const kanjiChars = Array.from(new Set(cleanQuery.match(/[\u4e00-\u9faf]/g) || []));
  for (const char of kanjiChars) {
    let kObj = kanjiMap.get(char);
    const jlptLevel = KANJI_JLPT_MAP[char] || kObj?.jlpt;

    if (!kObj && CORE_KANJI_DICT[char]) {
      const core = CORE_KANJI_DICT[char];
      kObj = {
        kanji: char,
        onyomi: core.onyomi,
        kunyomi: core.kunyomi,
        meanings: core.meanings,
        jlpt: core.jlpt || jlptLevel,
      };
    }

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
        jlpt: jlptLevel,
      };
    } else if (kObj) {
      kObj = { ...kObj, jlpt: jlptLevel || kObj.jlpt };
    }

    if (kObj) {
      matchedKanji.push(kObj);
    } else {
      matchedKanji.push({
        kanji: char,
        onyomi: [],
        kunyomi: [],
        meanings: ["Karakter Kanji"],
        jlpt: jlptLevel,
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
