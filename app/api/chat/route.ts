/**
 * AI Chat API route — GPT-5.4 Nano via OpenRouter (primary) or OpenAI (fallback).
 * Edge runtime for fastest cold starts. Zero tokens until a message arrives.
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
    }: {
        messages: UIMessage[];
        userName?: string;
        userRole?: string;
        currentPage?: string;
    } = body;

    const tools = createTools();

    const result = streamText({
        model: getModel(),
        system: buildSystemPrompt({ userName, userRole, currentPage }),
        messages: await convertToModelMessages(messages),
        tools,
        stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
}
