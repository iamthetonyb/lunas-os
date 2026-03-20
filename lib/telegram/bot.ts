/**
 * Telegram bot handler for LUNAS AI.
 * Same AI tools + system prompt as the web chat widget.
 * Uses Grammy for serverless webhook processing.
 */
import { Bot } from "grammy";
import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";

let bot: Bot | null = null;

export function getBot(): Bot {
    if (bot) return bot;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

    bot = new Bot(token);
    return bot;
}

function getModel() {
    if (process.env.OPENROUTER_API_KEY) {
        const openrouter = createOpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
        });
        return openrouter("openai/gpt-5.4-nano");
    }
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai("gpt-5.4-nano");
}

// Per-chat conversation history (in-memory, resets on cold start)
const chatHistory = new Map<
    number,
    Array<{ role: "user" | "assistant"; content: string }>
>();

const MAX_HISTORY = 20;

export async function handleMessage(
    chatId: number,
    text: string,
    senderName: string
) {
    // Get or create conversation history
    const history = chatHistory.get(chatId) ?? [];
    history.push({ role: "user", content: text });

    // Trim to last N messages
    if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
    }
    chatHistory.set(chatId, history);

    // Tools — admin by default for Telegram (authorized users)
    const tools = createTools({ userRole: "ADMIN" });

    const systemPrompt = buildSystemPrompt({
        userName: senderName,
        userRole: "ADMIN",
        currentPage: "telegram",
        preferredLang: "EN",
    });

    const result = await generateText({
        model: getModel(),
        system: systemPrompt,
        messages: history,
        tools,
        stopWhen: stepCountIs(10),
    });

    const responseText =
        result.text || "I processed your request but have no text to show.";

    // Store assistant response
    history.push({ role: "assistant", content: responseText });
    chatHistory.set(chatId, history);

    return responseText;
}

/**
 * Set the webhook URL with Telegram.
 * Call this once after deploy to register the webhook.
 */
export async function setWebhook(url: string) {
    const bot = getBot();
    await bot.api.setWebhook(url, {
        allowed_updates: ["message"],
    });
    return { ok: true, url };
}
