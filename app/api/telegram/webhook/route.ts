/**
 * Telegram webhook endpoint.
 * Receives updates from Telegram, processes through LUNAS AI,
 * and sends responses back.
 *
 * Setup: POST /api/telegram/webhook?action=register to set the webhook URL.
 * After that, Telegram sends all messages here automatically.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBot, handleMessage, setWebhook } from "@/lib/telegram/bot";

export const maxDuration = 30; // Allow up to 30s for AI tool calls

export async function POST(req: NextRequest) {
    // Register webhook (one-time setup)
    const action = req.nextUrl.searchParams.get("action");
    if (action === "register") {
        const secret = req.nextUrl.searchParams.get("secret");
        if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const baseUrl =
            process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : process.env.BASE_URL || "http://localhost:4010";
        const webhookUrl = `${baseUrl}/api/telegram/webhook`;
        const result = await setWebhook(webhookUrl);
        return NextResponse.json(result);
    }

    // Process incoming Telegram update
    try {
        const update = await req.json();

        // Only handle text messages
        const message = update.message;
        if (!message?.text) {
            return NextResponse.json({ ok: true });
        }

        const chatId = message.chat.id;
        const text = message.text;
        const senderName =
            message.from?.first_name ||
            message.from?.username ||
            "Telegram User";

        // Skip bot commands that aren't meant for AI
        if (text === "/start") {
            const bot = getBot();
            await bot.api.sendMessage(
                chatId,
                "LUNAS AI connected. Ask me about schedules, jobs, crews, or give commands like:\n\n" +
                    '- "What jobs are scheduled for tomorrow?"\n' +
                    '- "Assign Anahi to lot 42"\n' +
                    '- "Run the scheduler"\n' +
                    '- "Show recent AI decisions"\n\n' +
                    "I have the same tools as the web app chat."
            );
            return NextResponse.json({ ok: true });
        }

        // Show typing indicator
        const bot = getBot();
        await bot.api.sendChatAction(chatId, "typing");

        // Process through AI
        const response = await handleMessage(chatId, text, senderName);

        // Telegram has a 4096 char limit — split if needed
        const chunks = splitMessage(response, 4000);
        for (const chunk of chunks) {
            await bot.api.sendMessage(chatId, chunk, {
                parse_mode: "Markdown",
            }).catch(async () => {
                // Fallback without markdown if parsing fails
                await bot.api.sendMessage(chatId, chunk);
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Telegram webhook error:", error);
        return NextResponse.json({ ok: true }); // Always 200 to Telegram
    }
}

function splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }

        // Try to split at a newline
        let splitAt = remaining.lastIndexOf("\n", maxLength);
        if (splitAt < maxLength * 0.5) {
            // No good newline — split at space
            splitAt = remaining.lastIndexOf(" ", maxLength);
        }
        if (splitAt < maxLength * 0.3) {
            splitAt = maxLength;
        }

        chunks.push(remaining.slice(0, splitAt));
        remaining = remaining.slice(splitAt).trimStart();
    }

    return chunks;
}
