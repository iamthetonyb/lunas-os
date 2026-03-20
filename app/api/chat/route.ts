/**
 * AI Chat API route — streams GPT-5.4 Nano responses with Convex tool calling.
 * Handles text + voice input uniformly (transcription happens client-side).
 */
import {
    streamText,
    UIMessage,
    convertToModelMessages,
    stepCountIs,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { createTools } from "@/lib/ai/tools";

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

    const systemPrompt = buildSystemPrompt({
        userName,
        userRole,
        currentPage,
    });

    const tools = createTools();

    const result = streamText({
        model: openai("gpt-5.4-nano"),
        system: systemPrompt,
        messages: await convertToModelMessages(messages),
        tools,
        // Allow up to 5 tool call rounds so the AI can chain lookups
        stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse();
}
