// Test script: fetches translation API and logs the result
async function test() {
  try {
    // Test 1: Google Translate Mobile HTML page
    const text = "小学校時代からの腐れ縁。";
    const mobileUrl = `https://translate.google.com/m?sl=ja&tl=id&q=${encodeURIComponent(text)}`;
    console.log("=== Testing Google Translate Mobile ===");
    console.log("URL:", mobileUrl);
    
    const res = await fetch(mobileUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    
    console.log("Status:", res.status);
    const html = await res.text();
    console.log("HTML length:", html.length);
    
    // Try multiple regex patterns
    const patterns = [
      /<div class="(?:result-container|t0)">([^<]+)<\/div>/i,
      /class="result-container"[^>]*>([^<]+)</i,
      /class="t0"[^>]*>([^<]+)</i,
      /"result-container">(.*?)</i,
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      console.log(`Pattern ${pattern}: match=${match ? match[1] : "NONE"}`);
    }

    // Save a snippet of the HTML to inspect
    const snippet = html.substring(0, 3000);
    console.log("\n=== HTML Snippet (first 3000 chars) ===");
    console.log(snippet);
    
    // Test 2: Google Translate API (JA -> EN)
    console.log("\n=== Testing JA -> EN API ===");
    const resEn = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const dataEn = await resEn.json();
    const enText = Array.isArray(dataEn) && dataEn[0]
      ? dataEn[0].map((item) => item[0]).filter(Boolean).join("")
      : "";
    console.log("EN Result:", enText);
    
    // Test 3: EN -> ID
    if (enText) {
      console.log("\n=== Testing EN -> ID API ===");
      const resId = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=id&dt=t&q=${encodeURIComponent(enText)}`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      const dataId = await resId.json();
      const idText = Array.isArray(dataId) && dataId[0]
        ? dataId[0].map((item) => item[0]).filter(Boolean).join("")
        : "";
      console.log("ID Result:", idText);
    }
    
    // Test 4: Direct JA -> ID API
    console.log("\n=== Testing Direct JA -> ID API ===");
    const resDirect = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=id&dt=t&q=${encodeURIComponent(text)}`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    const dataDirect = await resDirect.json();
    const directText = Array.isArray(dataDirect) && dataDirect[0]
      ? dataDirect[0].map((item) => item[0]).filter(Boolean).join("")
      : "";
    console.log("Direct ID Result:", directText);
    
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
