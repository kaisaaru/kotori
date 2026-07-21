import { NextResponse } from "next/server";

/**
 * Full Sentence AI Translation API (Disabled by default)
 * To enable in the future:
 * 1. Add your active GEMINI_API_KEY in `.env.local`
 * 2. Uncomment the fetch call and UI card in `src/components/reader/SelectionPopup.tsx`
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("q")?.trim() || "";

  if (!text) {
    return NextResponse.json({ translation: "" });
  }

  if (GEMINI_API_KEY) {
    try {
      const result = await translateWithGemini(text);
      if (result) {
        return NextResponse.json({ translation: result });
      }
    } catch (err) {
      console.error("[translate] Gemini error:", err);
    }
  }

  return NextResponse.json({ translation: "" });
}

async function translateWithGemini(text: string): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `Terjemahkan kalimat bahasa Jepang berikut ke dalam Bahasa Indonesia yang alami dan akurat. Perhatikan idiom dan nuansa makna, jangan terjemahkan secara harfiah. Hanya berikan hasil terjemahan saja tanpa penjelasan.

Kalimat Jepang:
${text}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  const translation = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (translation) {
    return translation;
  }

  return null;
}
