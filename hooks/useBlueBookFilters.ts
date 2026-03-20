import { useState, useEffect, useCallback } from "react";
import type { BlueBookFilters, BlueBookSort } from "@/types/blue-book";

function useDebounce<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

export function useBlueBookFilters() {
    const [filters, setFilters] = useState<BlueBookFilters>({
        builderId: null,
        status: null,
        invoiced: null,
        search: "",
        sort: "community",
        startDateFrom: null,
        startDateTo: null,
    });

    const debouncedSearch = useDebounce(filters.search, 300);

    const setBuilderId = useCallback((builderId: string | null) => {
        setFilters((prev) => ({ ...prev, builderId }));
    }, []);

    const setStatus = useCallback((status: string | null) => {
        setFilters((prev) => ({ ...prev, status }));
    }, []);

    const setInvoiced = useCallback((invoiced: boolean | null) => {
        setFilters((prev) => ({ ...prev, invoiced }));
    }, []);

    const setSearch = useCallback((search: string) => {
        setFilters((prev) => ({ ...prev, search }));
    }, []);

    const setSort = useCallback((sort: BlueBookSort) => {
        setFilters((prev) => ({ ...prev, sort }));
    }, []);

    const setDateRange = useCallback(
        (from: string | null, to: string | null) => {
            setFilters((prev) => ({
                ...prev,
                startDateFrom: from,
                startDateTo: to,
            }));
        },
        []
    );

    const resetFilters = useCallback(() => {
        setFilters({
            builderId: null,
            status: null,
            invoiced: null,
            search: "",
            sort: "community",
            startDateFrom: null,
            startDateTo: null,
        });
    }, []);

    return {
        filters: { ...filters, search: debouncedSearch },
        rawSearch: filters.search,
        setBuilderId,
        setStatus,
        setInvoiced,
        setSearch,
        setSort,
        setDateRange,
        resetFilters,
    };
}
