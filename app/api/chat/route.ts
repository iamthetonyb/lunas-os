/**
 * AI Chat API route — GPT-5.4 Nano via OpenRouter (primary) or OpenAI (fallback).
 * Node.js runtime (ConvexHttpClient requires Node). Write operations auto-log to audit trail.
 */
import {
    streamText,
    UIMessage,
    convertToModelMessages,
    stepCountIs,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";

// Prefer OpenRouter (cheaper, key rotation, fallback models).
// Falls back to direct OpenAI if no OpenRouter key is set.
function getModel() {
    if (process.env.OPENROUTER_API_KEY) {
        const openrouter = createOpenRouter({
            apiKey: process.env.OPENROUTER_API_KEY,
        });
        return openrouter("openai/gpt-5.4-nano");
    }
    const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    return openai("gpt-5.4-nano");
}

export async function POST(req: Request) {
    const body = await req.json();
    const {
        messages,
        userName,
        userRole,
        currentPage,
        preferredLang,
    }: {
        messages: UIMessage[];
        userName?: string;
        userRole?: string;
        currentPage?: string;
        preferredLang?: string;
    } = body;

    const tools = createTools({ userRole: userRole || undefined });

    const result = streamText({
        model: getModel(),
        system: buildSystemPrompt({ userName, userRole, currentPage, preferredLang }),
        messages: await convertToModelMessages(messages),
        tools,
        stopWhen: stepCountIs(10),
    });

    return result.toUIMessageStreamResponse();
}
