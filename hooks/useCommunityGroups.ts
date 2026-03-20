import { useMemo } from "react";
import type {
    BlueBookEntry,
    CommunityGroup,
    LotSummary,
    LotPhase,
    LotPhaseService,
    PhaseDefinition,
    PhaseOverrideState,
} from "@/types/blue-book";

/**
 * Groups Blue Book entries into Community → Lot → Phase hierarchy.
 * Computes phase completion status using entries + overrides.
 */
export function useCommunityGroups(
    entries: BlueBookEntry[],
    phases: PhaseDefinition[],
    overrideMap: Map<string, PhaseOverrideState>
): CommunityGroup[] {
    return useMemo(() => {
        if (!entries.length) return [];

        // Group entries by community
        const byCommunity = new Map<string, BlueBookEntry[]>();
        for (const entry of entries) {
            const key = entry.communityName ?? "Unknown";
            if (!byCommunity.has(key)) byCommunity.set(key, []);
            byCommunity.get(key)!.push(entry);
        }

        const groups: CommunityGroup[] = [];

        for (const [communityName, communityEntries] of byCommunity) {
            // Group by lot within community
            const byLot = new Map<string, BlueBookEntry[]>();
            for (const entry of communityEntries) {
                const lot = entry.lot ?? "Unknown";
                if (!byLot.has(lot)) byLot.set(lot, []);
                byLot.get(lot)!.push(entry);
            }

            const lots: LotSummary[] = [];

            for (const [lot, lotEntries] of byLot) {
                // If no phases defined, create a single "all entries" phase
                const effectivePhases: PhaseDefinition[] = phases.length > 0 ? phases : [{
                    _id: 'all',
                    code: 'ALL',
                    title: 'All Services',
                    shorthand: 'ALL',
                    serviceNames: [...new Set(lotEntries.map(e => e.serviceName ?? e.accountCategoryName ?? '').filter(Boolean))],
                    sortOrder: 0,
                    active: true,
                } as PhaseDefinition];

                // Build phases for this lot
                const lotPhases: LotPhase[] = effectivePhases.map((phase) => {
                    // Find entries matching this phase's services
                    const matchingEntries = lotEntries.filter((e) =>
                        phase.serviceNames.some(
                            (sn) =>
                                e.serviceName?.toLowerCase().includes(sn.toLowerCase()) ||
                                e.accountCategoryName?.toLowerCase().includes(sn.toLowerCase())
                        )
                    );

                    // Build service-level detail
                    const services: LotPhaseService[] = phase.serviceNames.map(
                        (serviceName) => {
                            const svcEntries = lotEntries.filter(
                                (e) =>
                                    e.serviceName?.toLowerCase().includes(serviceName.toLowerCase()) ||
                                    e.accountCategoryName?.toLowerCase().includes(serviceName.toLowerCase())
                            );
                            const baseLogged = svcEntries.length > 0;

                            // Check override for this specific service
                            const overrideKey = `${lot}:${phase.code}`;
                            const override = overrideMap.get(overrideKey);
                            const svcOverride = override?.services?.[serviceName];

                            return {
                                name: serviceName,
                                entries: svcEntries,
                                baseLogged,
                                overrideStatus: svcOverride,
                                isLogged: svcOverride ?? baseLogged,
                            };
                        }
                    );

                    // Phase completion: all services logged
                    const baseComplete = services.every((s) => s.baseLogged);
                    const overrideKey = `${lot}:${phase.code}`;
                    const phaseOverride = overrideMap.get(overrideKey);
                    const overrideStatus = phaseOverride?.phase;

                    return {
                        code: phase.code,
                        title: phase.title,
                        shorthand: phase.shorthand,
                        matchingEntries,
                        services,
                        baseComplete,
                        overrideStatus,
                        isComplete: overrideStatus ?? baseComplete,
                    };
                });

                // Get model plan from first entry that has it
                const withModel = lotEntries.find((e) => e.modelPlanCode);

                lots.push({
                    key: `${communityEntries[0]?.communityId ?? "unknown"}:${lot}`,
                    lot,
                    entries: lotEntries,
                    phases: lotPhases,
                    modelPlanCode: withModel?.modelPlanCode ?? null,
                    modelPlanSqft: withModel?.modelPlanSqft ?? null,
                });
            }

            // Sort lots naturally
            lots.sort((a, b) => {
                const numA = parseInt(a.lot);
                const numB = parseInt(b.lot);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.lot.localeCompare(b.lot);
            });

            const completed = communityEntries.filter(
                (e) => e.status === "COMPLETE"
            ).length;

            groups.push({
                communityName,
                communityId: communityEntries[0]?.communityId ?? null,
                lots,
                totalEntries: communityEntries.length,
                completedEntries: completed,
            });
        }

        // Sort communities alphabetically
        groups.sort((a, b) => a.communityName.localeCompare(b.communityName));

        return groups;
    }, [entries, phases, overrideMap]);
}
