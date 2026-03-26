/**
 * POST /api/chat-notify — sends email notifications for new chat messages.
 * Called from client after sending a message.
 */
import { NextRequest, NextResponse } from "next/server";
import { sendChatNotificationEmail } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const { recipients, senderName, messagePreview, conversationName } =
            await req.json();

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return NextResponse.json({ error: "No recipients" }, { status: 400 });
        }

        const results = await Promise.allSettled(
            recipients.map((email: string) =>
                sendChatNotificationEmail(email, senderName, messagePreview, conversationName)
            )
        );

        const sent = results.filter((r) => r.status === "fulfilled").length;
        return NextResponse.json({ sent, total: recipients.length });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
