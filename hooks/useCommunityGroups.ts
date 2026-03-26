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
 *
 * Phase resolution order (per community):
 * 1. communityPhasesMap[communityId] — community-specific phases
 * 2. builderPhases — builder-level defaults
 * 3. Synthetic "All Services" phase if neither exists
 */
export function useCommunityGroups(
    entries: BlueBookEntry[],
    builderPhases: PhaseDefinition[],
    overrideMap: Map<string, PhaseOverrideState>,
    communityPhasesMap?: Map<string, PhaseDefinition[]>
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
            const communityId = communityEntries[0]?.communityId ?? null;

            // Resolve phases: community-specific > builder defaults > synthetic
            let effectivePhases: PhaseDefinition[];
            const communityPhases = communityId ? communityPhasesMap?.get(communityId) : undefined;
            if (communityPhases && communityPhases.length > 0) {
                effectivePhases = communityPhases;
            } else if (builderPhases.length > 0) {
                effectivePhases = builderPhases;
            } else {
                effectivePhases = [];
            }

            // Group by lot within community
            const byLot = new Map<string, BlueBookEntry[]>();
            for (const entry of communityEntries) {
                const lot = entry.lot ?? "Unknown";
                if (!byLot.has(lot)) byLot.set(lot, []);
                byLot.get(lot)!.push(entry);
            }

            const lots: LotSummary[] = [];

            for (const [lot, lotEntries] of byLot) {
                // If no phases defined at any level, create a single synthetic phase
                const phasesForLot: PhaseDefinition[] = effectivePhases.length > 0 ? effectivePhases : [{
                    _id: 'all',
                    code: 'ALL',
                    title: 'All Services',
                    shorthand: 'ALL',
                    serviceNames: [...new Set(lotEntries.map(e => e.serviceName ?? e.accountCategoryName ?? '').filter(Boolean))],
                    sortOrder: 0,
                    active: true,
                } as PhaseDefinition];

                // Track which entries are claimed by a defined phase
                const claimedEntryIds = new Set<string>();

                // Build phases for this lot
                const lotPhases: LotPhase[] = phasesForLot.map((phase) => {
                    const matchingEntries = lotEntries.filter((e) =>
                        phase.serviceNames.some(
                            (sn) =>
                                e.serviceName?.toLowerCase().includes(sn.toLowerCase()) ||
                                e.accountCategoryName?.toLowerCase().includes(sn.toLowerCase())
                        )
                    );

                    // Mark these entries as claimed
                    for (const me of matchingEntries) {
                        if (me._id) claimedEntryIds.add(me._id);
                    }

                    const services: LotPhaseService[] = phase.serviceNames.map(
                        (serviceName) => {
                            const svcEntries = lotEntries.filter(
                                (e) =>
                                    e.serviceName?.toLowerCase().includes(serviceName.toLowerCase()) ||
                                    e.accountCategoryName?.toLowerCase().includes(serviceName.toLowerCase())
                            );
                            const baseLogged = svcEntries.length > 0;
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

                // Collect unclaimed entries — services that don't match any defined phase
                const unclaimedEntries = lotEntries.filter(
                    (e) => e._id && !claimedEntryIds.has(e._id)
                );

                // If there are unclaimed entries, create a dynamic "Other" phase
                // so nothing is invisible
                if (unclaimedEntries.length > 0) {
                    const otherServiceNames = [
                        ...new Set(
                            unclaimedEntries
                                .map((e) => e.serviceName ?? e.accountCategoryName ?? '')
                                .filter(Boolean)
                        ),
                    ];
                    const otherServices: LotPhaseService[] = otherServiceNames.map(
                        (serviceName) => {
                            const svcEntries = unclaimedEntries.filter(
                                (e) =>
                                    e.serviceName?.toLowerCase().includes(serviceName.toLowerCase()) ||
                                    e.accountCategoryName?.toLowerCase().includes(serviceName.toLowerCase())
                            );
                            return {
                                name: serviceName,
                                entries: svcEntries,
                                baseLogged: svcEntries.length > 0,
                                overrideStatus: undefined,
                                isLogged: svcEntries.length > 0,
                            };
                        }
                    );
                    const overrideKey = `${lot}:OTHER`;
                    const phaseOverride = overrideMap.get(overrideKey);
                    lotPhases.push({
                        code: 'OTHER',
                        title: 'Other Services',
                        shorthand: 'Other',
                        matchingEntries: unclaimedEntries,
                        services: otherServices,
                        baseComplete: otherServices.every((s) => s.baseLogged),
                        overrideStatus: phaseOverride?.phase,
                        isComplete: phaseOverride?.phase ?? otherServices.every((s) => s.baseLogged),
                    });
                }

                const withModel = lotEntries.find((e) => e.modelPlanCode);

                lots.push({
                    key: `${communityId ?? "unknown"}:${lot}`,
                    lot,
                    entries: lotEntries,
                    phases: lotPhases,
                    modelPlanCode: withModel?.modelPlanCode ?? null,
                    modelPlanSqft: withModel?.modelPlanSqft ?? null,
                });
            }

            const completed = communityEntries.filter(
                (e) => e.status === "COMPLETE"
            ).length;

            groups.push({
                communityName,
                communityId,
                lots,
                totalEntries: communityEntries.length,
                completedEntries: completed,
            });
        }

        groups.sort((a, b) => a.communityName.localeCompare(b.communityName));

        return groups;
    }, [entries, builderPhases, overrideMap, communityPhasesMap]);
}
