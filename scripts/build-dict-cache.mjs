import fs from "fs";
import path from "path";
import JSZip from "jszip";

function parseStructuredNode(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    return node.map(parseStructuredNode).filter(Boolean).join(" ");
  }
  if (typeof node === "object") {
    if (node.content) return parseStructuredNode(node.content);
    if (node.text) return String(node.text);
  }
  return "";
}

function cleanMeaningString(text) {
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

async function buildCache() {
  console.log("🚀 Starting dictionary build-time cache indexing...");
  const startTime = Date.now();

  const termMap = new Map();
  const kanjiMap = new Map();

  let refDir = path.join(process.cwd(), "reference", "kotoba-rumus");
  if (!fs.existsSync(refDir)) {
    refDir = path.join(process.cwd(), "reference");
  }

  if (!fs.existsSync(refDir)) {
    console.log("⚠️ No reference directory found. Skipping dictionary build.");
    return;
  }

  const files = fs.readdirSync(refDir).filter((f) => {
    const lower = f.toLowerCase();
    return lower.endsWith(".zip") && !lower.includes("素材辞典");
  });

  console.log(`📦 Found ${files.length} dictionary ZIP files to index.`);

  for (const filename of files) {
    try {
      console.log(`  -> Processing ${filename}...`);
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

      for (const tf of termFiles) {
        const fileObj = contents.file(tf);
        if (!fileObj) continue;
        const text = await fileObj.async("string");
        const entries = JSON.parse(text);

        for (const entry of entries) {
          if (Array.isArray(entry) && entry.length >= 6) {
            const expression = String(entry[0] || "");
            const reading = String(entry[1] || "");
            const rawMeanings = entry[5];

            let meanings = [];
            if (Array.isArray(rawMeanings)) {
              meanings = rawMeanings.map(cleanMeaningString).filter(Boolean);
            } else if (rawMeanings) {
              const cleaned = cleanMeaningString(rawMeanings);
              if (cleaned) meanings = [cleaned];
            }

            if (expression && meanings.length > 0) {
              const termObj = {
                dictName: dictTitle,
                expression,
                reading: reading || expression,
                meanings,
                tags: typeof entry[2] === "string" ? [entry[2]] : [],
              };

              const existing = termMap.get(expression) || [];
              existing.push(termObj);
              termMap.set(expression, existing);
            }
          }
        }
      }

      const kanjiFiles = Object.keys(contents.files).filter((name) =>
        /kanji_bank_\d+\.json$/i.test(name)
      );

      for (const kf of kanjiFiles) {
        const fileObj = contents.file(kf);
        if (!fileObj) continue;
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
      }
    } catch (err) {
      console.warn(`⚠️ Error indexing ${filename}:`, err);
    }
  }

  // Ensure public and src/data directories exist
  const outputDirs = [
    path.join(process.cwd(), "public"),
    path.join(process.cwd(), "src", "data"),
    path.join(process.cwd(), ".next"),
  ];

  const payload = JSON.stringify({
    terms: Array.from(termMap.entries()),
    kanji: Array.from(kanjiMap.entries()),
  });

  for (const outDir of outputDirs) {
    try {
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const cachePath = path.join(outDir, "dict-cache-v1.json");
      fs.writeFileSync(cachePath, payload);
      console.log(`✅ Dictionary cache saved to ${cachePath}`);
    } catch (err) {
      console.warn(`Failed writing to ${outDir}:`, err);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✨ Dictionary indexing complete in ${duration}s! Total Terms: ${termMap.size}, Total Kanji: ${kanjiMap.size}`);
}

buildCache().catch(console.error);
