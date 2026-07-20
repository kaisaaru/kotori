import JSZip from "jszip";
import DOMPurify from "dompurify";
import { generateId } from "@/lib/utils";
import type { BookMeta, Chapter } from "@/types/book";

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

interface SpineItem {
  idref: string;
  linear: boolean;
}

/**
 * Parse an EPUB file and extract metadata + chapters.
 * EPUB is a ZIP containing XHTML, CSS, images, and an OPF manifest.
 */
export async function parseEpub(
  file: File
): Promise<{ book: BookMeta; chapters: Chapter[] }> {
  const zip = await JSZip.loadAsync(file);

  // 1. Find the rootfile path from META-INF/container.xml
  const containerXml = await zip.file("META-INF/container.xml")?.async("text");
  if (!containerXml) throw new Error("Invalid EPUB: missing container.xml");

  const containerDoc = new DOMParser().parseFromString(containerXml, "text/xml");
  const rootfilePath =
    containerDoc.querySelector("rootfile")?.getAttribute("full-path") ?? "";
  if (!rootfilePath) throw new Error("Invalid EPUB: missing rootfile path");

  // 2. Parse the OPF (Open Packaging Format) file
  const opfXml = await zip.file(rootfilePath)?.async("text");
  if (!opfXml) throw new Error("Invalid EPUB: missing OPF file");

  const opfDoc = new DOMParser().parseFromString(opfXml, "text/xml");
  const opfDir = rootfilePath.includes("/")
    ? rootfilePath.substring(0, rootfilePath.lastIndexOf("/") + 1)
    : "";

  // 3. Extract metadata
  const getMetaText = (tag: string): string => {
    const el =
      opfDoc.querySelector(`metadata > ${tag}`) ??
      opfDoc.querySelector(`metadata > *|${tag}`) ??
      opfDoc.querySelector(`[property="${tag}"]`);
    return el?.textContent?.trim() ?? "";
  };

  const title = getMetaText("title") || file.name.replace(/\.epub$/i, "");
  const author = getMetaText("creator") || "Unknown Author";
  const language = getMetaText("language") || "ja";

  // 4. Build manifest map
  const manifestItems = new Map<string, ManifestItem>();
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    const id = item.getAttribute("id") ?? "";
    const href = item.getAttribute("href") ?? "";
    const mediaType = item.getAttribute("media-type") ?? "";
    manifestItems.set(id, { id, href, mediaType });
  });

  // 5. Extract cover image
  let coverUrl: string | null = null;
  // Try meta cover
  const coverMeta = opfDoc.querySelector('meta[name="cover"]');
  if (coverMeta) {
    const coverId = coverMeta.getAttribute("content") ?? "";
    const coverItem = manifestItems.get(coverId);
    if (coverItem) {
      coverUrl = await extractImageAsDataUrl(zip, opfDir + coverItem.href);
    }
  }
  // Fallback: look for cover-image property or items with 'cover' in id/href
  if (!coverUrl) {
    const coverPropItem =
      opfDoc.querySelector('item[properties~="cover-image"]') ||
      opfDoc.querySelector('item[id*="cover" i]') ||
      opfDoc.querySelector('item[href*="cover" i]');
    if (coverPropItem) {
      const href = coverPropItem.getAttribute("href") ?? "";
      coverUrl = await extractImageAsDataUrl(zip, opfDir + href);
    }
  }

  // 6. Get spine (reading order)
  const spineItems: SpineItem[] = [];
  opfDoc.querySelectorAll("spine > itemref").forEach((ref) => {
    spineItems.push({
      idref: ref.getAttribute("idref") ?? "",
      linear: ref.getAttribute("linear") !== "no",
    });
  });

  // 7. Extract chapters
  const bookId = generateId();
  const chapters: Chapter[] = [];

  for (let i = 0; i < spineItems.length; i++) {
    const spineItem = spineItems[i];
    const manifestItem = manifestItems.get(spineItem.idref);
    if (!manifestItem) continue;

    const chapterPath = opfDir + manifestItem.href;
    const chapterXml = await zip.file(chapterPath)?.async("text");
    if (!chapterXml) continue;

    // Robust document parsing: try text/html first to avoid XML parsererror on &nbsp; or custom EPUB entities
    let chapterDoc = new DOMParser().parseFromString(chapterXml, "text/html");
    let body = chapterDoc.querySelector("body");

    // If body is empty or null, fallback to XML parsing
    if (!body || body.children.length === 0) {
      const xmlDoc = new DOMParser().parseFromString(chapterXml, "application/xhtml+xml");
      if (!xmlDoc.querySelector("parsererror") && xmlDoc.querySelector("body")) {
        chapterDoc = xmlDoc as unknown as Document;
        body = xmlDoc.querySelector("body");
      }
    }

    if (!body) continue;

    // Process HTML <img> tags
    const images = body.querySelectorAll("img");
    for (const img of Array.from(images)) {
      const src = img.getAttribute("src");
      if (src && !src.startsWith("data:")) {
        const imgPath = resolveRelativePath(chapterPath, src);
        const dataUrl = await extractImageAsDataUrl(zip, imgPath);
        if (dataUrl) {
          img.setAttribute("src", dataUrl);
          if (!coverUrl && i === 0) coverUrl = dataUrl;
        }
      }
    }

    // Process SVG <image> tags (common in Japanese Light Novels for full-page illustrations)
    const svgImages = body.querySelectorAll("image, svg image");
    for (const svgImg of Array.from(svgImages)) {
      const href = svgImg.getAttribute("xlink:href") || svgImg.getAttribute("href");
      if (href && !href.startsWith("data:")) {
        const imgPath = resolveRelativePath(chapterPath, href);
        const dataUrl = await extractImageAsDataUrl(zip, imgPath);
        if (dataUrl) {
          svgImg.setAttribute("href", dataUrl);
          svgImg.setAttribute("xlink:href", dataUrl);
          if (!coverUrl && i === 0) coverUrl = dataUrl;
        }
      }
    }

    // Extract chapter title
    const headingEl = body.querySelector("h1, h2, h3, h4, title");
    const chapterTitle =
      headingEl?.textContent?.trim() ||
      `Chapter ${i + 1}`;

    // Strip inline colors/backgrounds so reader themes apply cleanly
    body.querySelectorAll("*").forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.color = "";
        el.style.backgroundColor = "";
        el.style.background = "";
      }
    });

    // Extract cleaned innerHTML
    let rawHtml = body.innerHTML;

    // Sanitize HTML keeping ruby and SVG tags intact
    let htmlContent = DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true, svg: true },
      ADD_TAGS: ["ruby", "rt", "rp", "svg", "image", "g", "path", "p", "div", "span"],
      ADD_ATTR: [
        "epub:type",
        "xlink:href",
        "href",
        "viewBox",
        "preserveAspectRatio",
        "width",
        "height",
        "x",
        "y",
        "src",
        "alt",
      ],
    });

    // If sanitization returned empty content, use rawHtml fallback
    if (!htmlContent || htmlContent.trim() === "") {
      htmlContent = rawHtml;
    }

    chapters.push({
      id: generateId(),
      bookId,
      index: i,
      title: chapterTitle,
      htmlContent,
      href: manifestItem.href,
    });
  }

  const book: BookMeta = {
    id: bookId,
    title,
    author,
    language,
    coverUrl,
    fileSize: file.size,
    totalChapters: chapters.length,
    uploadedAt: Date.now(),
    lastReadAt: null,
  };

  return { book, chapters };
}

/** Extract an image from the ZIP and return as a data URL */
async function extractImageAsDataUrl(
  zip: JSZip,
  path: string
): Promise<string | null> {
  try {
    // Try exact path first
    let file = zip.file(path);

    // If not found, try case-insensitive / normalized lookup
    if (!file) {
      const normalizedTarget = path.toLowerCase().replace(/^\//, "");
      const matchedKey = Object.keys(zip.files).find(
        (key) => key.toLowerCase().replace(/^\//, "") === normalizedTarget
      );
      if (matchedKey) {
        file = zip.file(matchedKey);
      }
    }

    if (!file) return null;
    const blob = await file.async("blob");
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Resolve a relative path from a base path */
function resolveRelativePath(basePath: string, relativePath: string): string {
  const baseDir = basePath.substring(0, basePath.lastIndexOf("/") + 1);
  const parts = (baseDir + relativePath).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }
  return resolved.join("/");
}
