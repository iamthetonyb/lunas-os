/**
 * Seed crews into Convex using existing user data
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

const CREWS = [
  { name: 'Anahi Crew', foremanEmail: 'anahi@lunas.local', skills: ['cleanup', 'frame'], capacityPerDay: 4 },
  { name: 'Chayo Crew', foremanEmail: 'chayo@lunas.local', skills: ['tubs', 'windows'], capacityPerDay: 3 },
  { name: 'Blanca Crew', foremanEmail: 'blanca@lunas.local', skills: ['power wash', 'detail'], capacityPerDay: 3 },
  { name: 'Raudel Crew', foremanEmail: 'raudel@lunas.local', skills: ['final'], capacityPerDay: 5 },
  { name: 'Francisco Crew', foremanEmail: 'francisco@lunas.local', skills: ['extras', 'service'], capacityPerDay: 2 },
];

async function main() {
  const convex = new ConvexHttpClient(CONVEX_URL);

  // Get all users from Convex to find foreman IDs
  const allUsers = await convex.query(api.queries.getUsers, {});
  console.log(`Found ${allUsers.length} users in Convex`);

  for (const crew of CREWS) {
    // Find the foreman user by email
    const foreman = allUsers.find((u: any) => u.email === crew.foremanEmail);
    if (!foreman) {
      console.warn(`⚠️  Foreman not found for ${crew.name} (${crew.foremanEmail}), creating without foremanId`);
    } else {
      console.log(`Found foreman ${foreman.name} (${foreman.id}) for ${crew.name}`);
    }

    // Insert crew into Convex
    const result = await convex.mutation(api.mutations.createCrew, {
      name: crew.name,
      foremanId: foreman?.id ?? undefined,
      skills: crew.skills,
      capacityPerDay: crew.capacityPerDay,
    });
    console.log(`✅ Created crew: ${crew.name}`, result);
  }

  console.log("\n🎉 All crews seeded successfully!");
}

main().catch(console.error);
