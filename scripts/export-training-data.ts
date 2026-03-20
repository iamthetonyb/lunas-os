/**
 * Export training data from Convex for model fine-tuning.
 *
 * Exports decision logs + conversation threads as JSONL files
 * compatible with nanochat's chat_sft.py training pipeline.
 *
 * Usage:
 *   pnpm tsx scripts/export-training-data.ts
 *   pnpm tsx scripts/export-training-data.ts --min-confidence 0.9 --output training/
 *
 * Output:
 *   training/sft_decisions.jsonl    — Decision-based training pairs (weighted)
 *   training/sft_conversations.jsonl — Full conversation threads
 *   training/manifest.json          — Dataset stats and quality metrics
 *
 * Training pipeline (nanochat-inspired):
 *   1. Export data → this script
 *   2. Upload to GPU instance (Colab H100 / RunPod / Lambda)
 *   3. Run SFT: python nanochat/scripts/chat_sft.py --data training/sft_decisions.jsonl
 *   4. Export to GGUF: python convert.py --outtype q4_0
 *   5. Deploy to CPU inference via llama.cpp or Ollama
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as fs from "fs";
import * as path from "path";

// Parse CLI args
const args = process.argv.slice(2);
const minConfidence = parseFloat(
    args.find((a) => a.startsWith("--min-confidence"))?.split("=")[1] || "0.7"
);
const outputDir =
    args.find((a) => a.startsWith("--output"))?.split("=")[1] || "training";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Set NEXT_PUBLIC_CONVEX_URL in .env.local");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

async function exportData() {
    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    console.log("Exporting training data from Convex...\n");

    // 1. Export high-confidence decisions
    console.log("1. Fetching decision logs...");
    const decisions = await client.query(
        api.distillation.getTrainingDecisions,
        { minConfidence, limit: 1000 }
    );
    console.log(`   Found ${(decisions as any[]).length} decisions (confidence >= ${minConfidence})`);

    // 2. Export conversation threads
    console.log("2. Fetching conversation threads...");
    const conversations = await client.query(
        api.distillation.getTrainingConversations,
        { limit: 500 }
    );
    console.log(`   Found ${(conversations as any[]).length} conversation threads`);

    // 3. Export SFT training data
    console.log("3. Generating SFT training data...");
    const sftData = await client.action(api.distillation.exportSFTData, {});
    const sft = sftData as any;
    console.log(
        `   Generated ${sft.count} SFT examples (gold: ${sft.stats.gold}, high: ${sft.stats.high}, standard: ${sft.stats.standard})`
    );

    // 4. Write JSONL files
    const decisionsPath = path.join(outputDir, "sft_decisions.jsonl");
    const conversationsPath = path.join(outputDir, "sft_conversations.jsonl");
    const manifestPath = path.join(outputDir, "manifest.json");

    // Write decisions as JSONL
    const decisionLines = sft.examples
        .map((ex: any) => JSON.stringify(ex))
        .join("\n");
    fs.writeFileSync(decisionsPath, decisionLines + "\n");
    console.log(`   Wrote ${decisionsPath}`);

    // Write conversations as JSONL
    const convLines = (conversations as any[])
        .map((conv: any) =>
            JSON.stringify({
                messages: conv.turns,
                weight: 1.0,
                metadata: { threadId: conv.threadId },
            })
        )
        .join("\n");
    fs.writeFileSync(conversationsPath, convLines + "\n");
    console.log(`   Wrote ${conversationsPath}`);

    // Write manifest
    const manifest = {
        exportedAt: new Date().toISOString(),
        source: "LUNAS-OS Convex",
        convexUrl: CONVEX_URL,
        files: {
            decisions: {
                path: "sft_decisions.jsonl",
                count: sft.count,
                stats: sft.stats,
            },
            conversations: {
                path: "sft_conversations.jsonl",
                count: (conversations as any[]).length,
            },
        },
        config: {
            minConfidence,
            weightScheme: {
                gold: "confidence >= 0.95 → weight 2.0",
                high: "confidence >= 0.85 → weight 1.5",
                standard: "confidence >= 0.70 → weight 1.0",
            },
        },
        training: {
            pipeline: "nanochat chat_sft.py",
            curriculum: "0wav 3-stage (foundation → enrichment → precision)",
            targetFormat: "GGUF q4_0 for CPU inference via Ollama",
        },
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`   Wrote ${manifestPath}`);

    console.log("\nDone. Training data exported.");
    console.log("\nNext steps:");
    console.log("  1. Upload training/ dir to GPU instance");
    console.log(
        "  2. Run SFT: python nanochat/scripts/chat_sft.py --data sft_decisions.jsonl"
    );
    console.log("  3. Convert: python convert.py --outtype q4_0");
    console.log("  4. Deploy: ollama create lunas-nano -f Modelfile");
}

exportData().catch(console.error);
