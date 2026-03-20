/**
 * Seed the RAG knowledge base with foundational operational knowledge.
 *
 * Run once after deployment:
 *   pnpm tsx scripts/seed-rag-knowledge.ts
 *
 * This gives the AI a baseline understanding of operations before
 * the learning loop (Insight Agent) starts generating its own patterns.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
    console.error("Set NEXT_PUBLIC_CONVEX_URL in .env.local");
    process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const KNOWLEDGE: { text: string; namespace: string }[] = [
    // ── Service descriptions ────────────────────────────────────────
    {
        namespace: "operations",
        text: "Clean Rough (CLEAN_ROUGH): Post-framing cleanup. Remove construction debris, sweep floors, clean windowsills. Done after rough electrical/plumbing/HVAC inspection.",
    },
    {
        namespace: "operations",
        text: "Clean Final (CLEAN_FINAL): Pre-move-in deep clean. Includes windows, tubs, floors, countertops, cabinets, light fixtures, appliances. Must pass builder quality check.",
    },
    {
        namespace: "operations",
        text: "Power Wash Driveway (POWER_WASH_DRIVE): High-pressure wash of driveway, sidewalks, and curbs. Often ordered after concrete pour or before final walkthrough.",
    },
    {
        namespace: "operations",
        text: "Power Wash Exterior (POWER_WASH_EXT): Full exterior power wash including siding, garage door, front entry. Often bundled with driveway wash.",
    },
    {
        namespace: "operations",
        text: "Window Cleaning (WINDOW_CLEAN): Interior and exterior window cleaning. Includes tracks, frames, and screens. Required before final inspection.",
    },
    {
        namespace: "operations",
        text: "Tub Cleaning (TUB_CLEAN): Deep clean of all bathtubs, shower surrounds, and shower pans. Removes construction residue, caulk smears, paint splatter.",
    },

    // ── Builder info ────────────────────────────────────────────────
    {
        namespace: "operations",
        text: "Pulte Homes is the primary builder client for Lunas. They manage 40+ communities in the region. PO numbers from Pulte follow the format PULTE-XXXX. Blue book entries are scraped from Pulte's builder portal.",
    },

    // ── Crew capabilities ───────────────────────────────────────────
    {
        namespace: "scheduling",
        text: "Crew Carmen: General cleanup crew, handles Clean Rough and Clean Final. Typical capacity 4-6 jobs/day depending on lot size.",
    },
    {
        namespace: "scheduling",
        text: "Crew Luis D: Specialty crew for power washing and exterior work. Has commercial-grade pressure washing equipment. Capacity 6-8 driveways/day.",
    },
    {
        namespace: "scheduling",
        text: "Crew Alan: Versatile crew, handles windows, tubs, and final cleans. Good for detail work. Capacity 3-4 final cleans/day.",
    },

    // ── Foreman info ────────────────────────────────────────────────
    {
        namespace: "scheduling",
        text: "Foreman Anahi: Most experienced foreman. Specializes in final cleans and quality-critical jobs. Preferred for builder walkthroughs and inspection-ready work.",
    },
    {
        namespace: "scheduling",
        text: "Foreman Blanca: Strong with rough cleans and high-volume days. Good at managing multiple crews across nearby communities.",
    },
    {
        namespace: "scheduling",
        text: "Foreman Chayo: Handles power wash and exterior crews. Bilingual (English/Spanish). Good rapport with Pulte superintendents.",
    },
    {
        namespace: "scheduling",
        text: "Foreman Francisco: Reliable backup foreman. Covers when primary foremen are unavailable. Experienced with all service types.",
    },
    {
        namespace: "scheduling",
        text: "Foreman Raudel: Newest foreman. Currently handling smaller communities to build experience. Good attention to detail on final cleans.",
    },

    // ── Operational procedures ──────────────────────────────────────
    {
        namespace: "operations",
        text: "Dispatch workflow: 1) Intake received → 2) Assigned to foreman + crew → 3) Scheduled for date → 4) Dispatched (batch created) → 5) Crew performs work → 6) Foreman marks complete → 7) Blue book entry for billing.",
    },
    {
        namespace: "operations",
        text: "Extra work handling: When a lot needs additional work beyond the original PO (e.g., re-clean after trade damage), it's flagged as extra work. Extra work gets a separate job request with isExtraWork=true and requires separate billing approval.",
    },
    {
        namespace: "operations",
        text: "Walk time: The scheduled time when a builder superintendent walks the lot to inspect work quality. Walk times are critical — missing one delays payment and builder trust. Always schedule work to complete at least 1 hour before walk time.",
    },

    // ── Pricing guidelines ──────────────────────────────────────────
    {
        namespace: "pricing",
        text: "Standard Clean Final pricing: $150-$350 depending on square footage and model plan. Larger homes (2500+ sqft) are at the higher end. Pulte rates are contracted per model plan.",
    },
    {
        namespace: "pricing",
        text: "Power Wash Driveway pricing: $75-$125 per lot. Combined driveway + exterior wash typically $150-$200. Volume pricing available for 10+ lots in same community on same day.",
    },
    {
        namespace: "pricing",
        text: "Clean Rough pricing: $100-$200 depending on lot size. Multi-story homes command higher rates due to stairwell and upper-floor debris.",
    },
];

async function seed() {
    console.log(`Seeding ${KNOWLEDGE.length} knowledge entries...`);

    for (const entry of KNOWLEDGE) {
        try {
            await client.action(api.ai.ingestKnowledge, {
                text: entry.text,
                namespace: entry.namespace,
            });
            console.log(`  + [${entry.namespace}] ${entry.text.slice(0, 60)}...`);
        } catch (err) {
            console.error(`  ! Failed: ${(err as Error).message}`);
        }
    }

    console.log("\nDone. RAG knowledge base seeded.");
}

seed();
