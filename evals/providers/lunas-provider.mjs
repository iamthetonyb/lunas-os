/**
 * Custom promptfoo provider for LUNAS AI.
 * Calls the chat API route as a black box, parsing streaming responses.
 *
 * Usage in promptfooconfig.yaml:
 *   providers:
 *     - id: file://providers/lunas-provider.mjs
 *       config:
 *         userName: 'Test Admin'
 *         userRole: 'ADMIN'
 *         baseUrl: 'http://localhost:3000'
 */

const DEFAULT_BASE = 'http://localhost:3000';

export default class LunasProvider {
    constructor(options) {
        this.config = options?.config || {};
        this.baseUrl = this.config.baseUrl || DEFAULT_BASE;
    }

    id() {
        return 'lunas-ai-chat';
    }

    async callApi(prompt) {
        const url = `${this.baseUrl}/api/chat`;

        const body = {
            messages: [{ role: 'user', content: prompt }],
            userName: this.config.userName || 'Test Admin',
            userRole: this.config.userRole || 'ADMIN',
            currentPage: this.config.currentPage || 'dashboard',
        };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                return {
                    error: `HTTP ${res.status}: ${res.statusText}`,
                };
            }

            // Parse streaming response — collect all text chunks
            const text = await res.text();

            // AI SDK stream format: lines prefixed with data type codes
            // Extract text content from the stream
            const lines = text.split('\n').filter(Boolean);
            const textParts = [];
            const toolCalls = [];

            for (const line of lines) {
                try {
                    // AI SDK UIMessage stream format
                    if (line.startsWith('0:')) {
                        // Text delta
                        const content = JSON.parse(line.slice(2));
                        if (typeof content === 'string') textParts.push(content);
                    } else if (line.startsWith('9:')) {
                        // Tool call
                        const call = JSON.parse(line.slice(2));
                        toolCalls.push(call);
                    }
                } catch {
                    // Skip unparseable lines
                }
            }

            const output = textParts.join('');

            return {
                output: output || '(no text response — tool calls only)',
                metadata: {
                    toolCalls,
                    toolCount: toolCalls.length,
                    rawLength: text.length,
                },
            };
        } catch (err) {
            return {
                error: `Request failed: ${err.message}`,
            };
        }
    }
}
