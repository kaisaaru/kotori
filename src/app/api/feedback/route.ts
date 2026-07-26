import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { category, message, contact, language } = await request.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
    }

    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    const categoryLabel =
      category === "bug"
        ? "🐞 Lapor Bug / Error"
        : category === "idea"
        ? "💡 Ide Fitur Baru"
        : "❤️ Apresiasi / Lainnya";

    const timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    let sentCount = 0;

    // 1. Send to Discord Webhook if configured
    if (discordWebhookUrl) {
      try {
        const discordPayload = {
          embeds: [
            {
              title: `Kotori Feedback: ${categoryLabel}`,
              color: category === "bug" ? 14423100 : category === "idea" ? 65280 : 16738740,
              fields: [
                {
                  name: "📝 Pesan",
                  value: message.trim(),
                  inline: false,
                },
                {
                  name: "👤 Kontak User",
                  value: contact && contact.trim() ? contact.trim() : "*Anonim*",
                  inline: true,
                },
                {
                  name: "🌐 Bahasa",
                  value: language || "ID",
                  inline: true,
                },
              ],
              footer: {
                text: `Kotori Web App • ${timestamp}`,
              },
            },
          ],
        };

        const res = await fetch(discordWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordPayload),
        });

        if (res.ok) sentCount++;
      } catch (err) {
        console.error("Failed to send Discord feedback:", err);
      }
    }

    // 2. Send to Telegram Bot if configured
    if (telegramBotToken && telegramChatId) {
      try {
        const teleText =
          `🌟 *Kotori Feedback Baru!*\n\n` +
          `📌 *Kategori:* ${categoryLabel}\n` +
          `📝 *Pesan:*\n${message.trim()}\n\n` +
          `👤 *Kontak:* ${contact && contact.trim() ? contact.trim() : "_Anonim_"}\n` +
          `🌐 *Bahasa:* ${language || "ID"}\n` +
          `🕒 *Waktu:* ${timestamp}`;

        const res = await fetch(
          `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: teleText,
              parse_mode: "Markdown",
            }),
          }
        );

        if (res.ok) sentCount++;
      } catch (err) {
        console.error("Failed to send Telegram feedback:", err);
      }
    }

    // If neither Discord nor Telegram are configured (or both failed),
    // log locally and return success so user UX is preserved in local dev before setup
    if (sentCount === 0) {
      console.log("=== KOTORI FEEDBACK RECEIVED (Local Log) ===");
      console.log(`Category: ${categoryLabel}`);
      console.log(`Message: ${message}`);
      console.log(`Contact: ${contact || "Anonymous"}`);
      console.log(`Language: ${language}`);
      console.log("============================================");
    }

    return NextResponse.json({ success: true, sentCount });
  } catch (error) {
    console.error("Feedback API Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan sistem saat mengirim feedback" },
      { status: 500 }
    );
  }
}