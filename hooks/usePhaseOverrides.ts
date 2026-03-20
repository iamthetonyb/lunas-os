import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useMemo } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { PhaseOverrideState } from "@/types/blue-book";

/**
 * DB-backed phase override read/write (replaces localStorage).
 * All overrides sync in real-time across devices via Convex.
 */
export function usePhaseOverrides(
    builderId: string | null,
    communityId: string | null
) {
    const overrides = useQuery(
        api.blueBookPhases.getOverridesByBuilderCommunity,
        builderId && communityId
            ? {
                  builderId: builderId as Id<"builders">,
                  communityId: communityId as Id<"communities">,
              }
            : "skip"
    );

    const setOverrideMutation = useMutation(api.blueBookPhases.setOverride);

    // Build a map: `${lot}:${phaseCode}` → override state
    const overrideMap = useMemo(() => {
        const map = new Map<string, PhaseOverrideState>();
        if (!overrides) return map;
        for (const o of overrides) {
            const key = `${o.lot}:${o.phaseCode}`;
            map.set(key, {
                phase: o.phaseComplete ?? undefined,
                services: o.serviceOverrides
                    ? JSON.parse(o.serviceOverrides)
                    : undefined,
            });
        }
        return map;
    }, [overrides]);

    const getOverride = useCallback(
        (lot: string, phaseCode: string): PhaseOverrideState | undefined => {
            return overrideMap.get(`${lot}:${phaseCode}`);
        },
        [overrideMap]
    );

    const setOverride = useCallback(
        async (
            lot: string,
            phaseCode: string,
            phaseComplete?: boolean,
            serviceOverrides?: Record<string, boolean>
        ) => {
            if (!builderId || !communityId) return;
            await setOverrideMutation({
                builderId: builderId as Id<"builders">,
                communityId: communityId as Id<"communities">,
                lot,
                phaseCode,
                phaseComplete,
                serviceOverrides: serviceOverrides
                    ? JSON.stringify(serviceOverrides)
                    : undefined,
            });
        },
        [builderId, communityId, setOverrideMutation]
    );

    return {
        overrides: overrideMap,
        getOverride,
        setOverride,
        isLoading: overrides === undefined,
    };
}
