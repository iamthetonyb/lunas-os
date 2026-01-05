'use client';

import { PageHeader } from '@/components/page-header';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetchJSON } from '@/lib/utils/fetch-json';
import { useSession } from 'next-auth/react';

const PAGE_SIZE = 25;

type BlueBookEntry = {
  id: string;
  builderName: string | null;
  builderId: string | null;
  communityName: string | null;
  communityId: string | null;
  lot: string | null;
  serviceName: string | null;
  serviceId?: string | null;
  accountCategoryCode: string | null;
  accountCategoryName: string | null;
  startDate: string | null;
  invoiceNumber: string | null;
  amount: string | null;
  status: string;
  checkNumber: string | null;
  checkDate: string | null;
  checkTotal: string | null;
  isAch: boolean | null;
  modelPlanId: string | null;
  modelPlanName: string | null;
  modelPlanCode: string | null;
  modelPlanSqft: string | null;
  source?: string | null; // 'scraped' or 'manual'
  createdAt: string;
  updatedAt: string;
};

type BlueBookResponse = {
  entries: BlueBookEntry[];
  total: number;
  page: number;
  pageSize: number;
};

type Builder = {
  id: string;
  name: string;
};

type ModelPlan = {
  id: string;
  builderId: string | null;
  name: string;
  code: string | null;
  sqft: string | null;
};

const fetcher = async (url: string): Promise<BlueBookResponse> => {
  const data = await fetchJSON<BlueBookResponse | BlueBookEntry[]>(url);
  if (Array.isArray(data)) {
    return {
      entries: data,
      total: data.length,
      page: 1,
      pageSize: data.length || PAGE_SIZE,
    };
  }
  return data;
};

const builderFetcher = (url: string) => fetchJSON<Builder[]>(url);

const modelPlanFetcher = (url: string) => fetchJSON<ModelPlan[]>(url);

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type PhaseDefinition = {
  code: string;
  title: string;
  shorthand: string;
  serviceNames: string[];
};

type LotPhaseService = {
  name: string;
  entries: BlueBookEntry[];
  baseLogged: boolean;
  overrideStatus: boolean | undefined;
  isLogged: boolean;
};

type LotPhase = {
  code: string;
  isComplete: boolean;
  baseComplete: boolean;
  overrideStatus: boolean | undefined;
  matchingEntries: BlueBookEntry[];
  title: string;
  shorthand: string;
  services: LotPhaseService[];
};

type PhaseOverrideState = {
  phase?: boolean;
  services?: Record<string, boolean>;
};

type PhaseOverrides = Record<string, Record<string, PhaseOverrideState>>;

type LotSummary = {
  key: string;
  lotLabel: string;
  lotValue: string | null;
  entries: BlueBookEntry[];
  phases: LotPhase[];
  builderId: string | null;
  modelPlanId: string | null;
  modelPlanName: string | null;
  modelPlanCode: string | null;
  modelPlanSqft: string | null;
  nextActivityDate: number;
  totalAmount: number;
};

type CommunityGroup = {
  key: string;
  builderName: string | null;
  builderId: string | null;
  communityName: string | null;
  entries: BlueBookEntry[];
  lots: LotSummary[];
  nextActivityDate: number;
  checkNumbers: string[];
  totalAmount: number;
};

const KNOWN_PHASES: Record<string, PhaseDefinition> = {
  '22702': {
    code: '22702',
    title: '22702 – T3',
    shorthand: 'T3',
    serviceNames: ['Frame Sweep'],
  },
  '22712': {
    code: '22712',
    title: '22712 – T2',
    shorthand: 'T2',
    serviceNames: ['Tubs & Windows', 'Q/A', 'Power Wash'],
  },
  '22714': {
    code: '22714',
    title: '22714 – T1',
    shorthand: 'T1',
    serviceNames: ['Final Clean', 'Touch up Clean'],
  },
};

const LOT_PHASE_STORAGE_KEY = 'lunas-blue-book:phase-overrides';

function normalizePhaseOverrideValue(value: unknown): PhaseOverrideState | undefined {
  if (typeof value === 'boolean') {
    return { phase: value };
  }

  if (value && typeof value === 'object') {
    const maybePhase = (value as { phase?: unknown }).phase;
    const phaseValue = typeof maybePhase === 'boolean' ? maybePhase : undefined;

    const servicesRaw = (value as { services?: unknown }).services;
    let services: Record<string, boolean> | undefined;
    if (servicesRaw && typeof servicesRaw === 'object') {
      const entries = Object.entries(servicesRaw as Record<string, unknown>).filter(
        ([, status]) => typeof status === 'boolean'
      );
      if (entries.length > 0) {
        services = Object.fromEntries(entries) as Record<string, boolean>;
      }
    }

    if (phaseValue === undefined && !services) {
      return undefined;
    }

    return {
      ...(phaseValue !== undefined ? { phase: phaseValue } : {}),
      ...(services ? { services } : {}),
    };
  }

  return undefined;
}

function areServiceOverridesEqual(
  a?: Record<string, boolean>,
  b?: Record<string, boolean>
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => b[key] === a[key]);
}

export default function BlueBookPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'checkDate' | 'startDate'>('startDate');
  const [activeBuilderId, setActiveBuilderId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<BlueBookEntry | null>(null);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [formState, setFormState] = useState({
    lot: '',
    startDate: '',
    status: 'PENDING',
    invoiceNumber: '',
    amount: '',
    accountCategoryName: '',
    accountCategoryCode: '',
    checkNumber: '',
    checkDate: '',
    builderId: '',
    communityId: '',
    serviceId: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTabBuilderId, setNewTabBuilderId] = useState('');

  // Session for admin check - admins can always see delete button
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin' || (session?.user as any)?.role === 'backoffice';

  // Populate form state when editing or creating
  useEffect(() => {
    if (editingEntry) {
      setFormState({
        lot: editingEntry.lot || '',
        startDate: editingEntry.startDate || '',
        status: editingEntry.status || 'PENDING',
        invoiceNumber: editingEntry.invoiceNumber || '',
        amount: editingEntry.amount || '',
        accountCategoryName: editingEntry.accountCategoryName || '',
        accountCategoryCode: editingEntry.accountCategoryCode || '',
        checkNumber: editingEntry.checkNumber || '',
        checkDate: editingEntry.checkDate || '',
        builderId: editingEntry.builderId || '',
        communityId: editingEntry.communityId || '',
        serviceId: editingEntry.serviceId || '',
      });
    } else if (isCreatingManual) {
      setFormState({
        lot: '',
        startDate: '',
        status: 'PENDING',
        invoiceNumber: '',
        amount: '',
        accountCategoryName: '',
        accountCategoryCode: '',
        checkNumber: '',
        checkDate: '',
        builderId: activeBuilderId || '',
        communityId: '',
        serviceId: '',
      });
    }
  }, [editingEntry, isCreatingManual, activeBuilderId]);

  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort, activeBuilderId]);

  const { data: buildersData } = useSWR('/api/builders', builderFetcher, {
    revalidateOnFocus: false,
  });
  const { data: modelPlansData } = useSWR('/api/model-plans', modelPlanFetcher, {
    revalidateOnFocus: false,
  });
  const { data: communitiesData } = useSWR('/api/communities', async (url) => {
    const res = await fetchJSON<Array<{ id: string; name: string; builderId?: string | null }>>(url);
    return res;
  }, {
    revalidateOnFocus: false,
  });
  const { data: servicesData } = useSWR('/api/services', async (url) => {
    const res = await fetchJSON<Array<{ id: string; name: string; code?: string | null }>>(url);
    return res;
  }, {
    revalidateOnFocus: false,
  });
  const availableBuilders = buildersData || [];
  const modelPlans = useMemo(() => modelPlansData ?? [], [modelPlansData]);
  const communities = useMemo(() => communitiesData ?? [], [communitiesData]);
  const services = useMemo(() => servicesData ?? [], [servicesData]);
  const plansByBuilder = useMemo(() => {
    const map: Record<string, ModelPlan[]> = {};
    modelPlans.forEach((plan) => {
      const key = plan.builderId ?? 'unknown';
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(plan);
    });
    Object.values(map).forEach((list) =>
      list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    );
    return map;
  }, [modelPlans]);
  const defaultTabNames = ['Pulte', 'KB Homes'];
  const defaultTabs = availableBuilders.filter((builder) =>
    defaultTabNames.includes(builder.name)
  );
  const [customTabIds, setCustomTabIds] = useState<string[]>([]);
  const [phaseOverrides, setPhaseOverrides] = useState<PhaseOverrides>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(LOT_PHASE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};

      const normalized: PhaseOverrides = {};
      Object.entries(parsed as Record<string, unknown>).forEach(([lotKey, phases]) => {
        if (!phases || typeof phases !== 'object') return;
        Object.entries(phases as Record<string, unknown>).forEach(([phaseCode, value]) => {
          const normalizedValue = normalizePhaseOverrideValue(value);
          if (normalizedValue) {
            if (!normalized[lotKey]) normalized[lotKey] = {};
            normalized[lotKey][phaseCode] = normalizedValue;
          }
        });
      });

      return normalized;
    } catch {
      return {};
    }
  });
  const [pendingPlanSelections, setPendingPlanSelections] = useState<
    Record<string, string | null>
  >({});
  const [savingPlanSelections, setSavingPlanSelections] = useState<Record<string, boolean>>({});
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});

  const tabBuilderIds = useMemo(() => {
    const ids = new Set<string>();
    defaultTabs.forEach((builder) => ids.add(builder.id));
    customTabIds.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [defaultTabs, customTabIds]);

  useEffect(() => {
    if (!activeBuilderId) {
      setActiveBuilderId(defaultTabs[0]?.id ?? 'all');
    }
  }, [defaultTabs, activeBuilderId]);

  const selectableBuilders = availableBuilders.filter(
    (builder) => !tabBuilderIds.includes(builder.id)
  );

  const builderParam =
    activeBuilderId && activeBuilderId !== 'all' ? `&builderId=${activeBuilderId}` : '';
  const { data, error, isLoading, mutate } = useSWR(
    `/api/blue-book?page=${page}&pageSize=${PAGE_SIZE}&sort=${sort}&search=${encodeURIComponent(
      debouncedSearch
    )}${builderParam}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const total = data?.total ?? entries.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    []
  );
  const formatAmount = useCallback(
    (value: string | null) => {
      if (!value) return '—';
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return '—';
      return currencyFormatter.format(numeric);
    },
    [currencyFormatter]
  );
  const formatNumberAmount = useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
      return currencyFormatter.format(value);
    },
    [currencyFormatter]
  );

  const communityGroups: CommunityGroup[] = useMemo(() => {
    type LotAccumulator = {
      key: string;
      lotLabel: string;
      lotValue: string | null;
      entries: BlueBookEntry[];
      builderId: string | null;
    };

    type CommunityAccumulator = {
      key: string;
      builderName: string | null;
      builderId: string | null;
      communityName: string | null;
      entries: BlueBookEntry[];
      lots: Map<string, LotAccumulator>;
    };

    const communityMap = new Map<string, CommunityAccumulator>();

    const normaliseCommunityKey = (entry: BlueBookEntry) => {
      // Use community ID if available, otherwise use community name + builder ID to group
      // This ensures same-named communities under same builder are grouped together
      if (entry.communityId) {
        return entry.communityId;
      }
      const communityName = entry.communityName?.toLowerCase().trim() || 'unknown';
      const builderId = entry.builderId || 'unknown';
      return `no-id:${builderId}:${communityName}`;
    };

    entries.forEach((entry) => {
      const communityKey = normaliseCommunityKey(entry);
      if (!communityMap.has(communityKey)) {
        communityMap.set(communityKey, {
          key: communityKey,
          builderName: entry.builderName ?? entry.builderId ?? 'Unknown Builder',
          builderId: entry.builderId,
          communityName: entry.communityName ?? 'Unknown Community',
          entries: [],
          lots: new Map(),
        });
      }

      const community = communityMap.get(communityKey)!;
      community.entries.push(entry);

      const lotLabel = entry.lot?.trim() || 'Unknown Lot';
      const lotKey = `${communityKey}:${lotLabel.toLowerCase()}`;
      if (!community.lots.has(lotKey)) {
        community.lots.set(lotKey, {
          key: lotKey,
          lotLabel,
          lotValue: entry.lot || null,
          entries: [],
          builderId: entry.builderId,
        });
      }
      community.lots.get(lotKey)!.entries.push(entry);
    });

    const toTimestamp = (value: string | null) =>
      value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;

    const parseAmount = (value: string | null) => {
      if (!value) return 0;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    return Array.from(communityMap.values())
      .map((community) => {
        const lots = Array.from(community.lots.values())
          .map((lot) => {
            const sortedEntries = lot.entries
              .slice()
              .sort(
                (a, b) =>
                  toTimestamp(a.startDate ?? a.checkDate) -
                  toTimestamp(b.startDate ?? b.checkDate)
              );

            const planSource = sortedEntries.find(
              (entry) => entry.modelPlanName || entry.modelPlanCode || entry.modelPlanSqft
            );

            const entriesByCode = new Map<string, BlueBookEntry[]>();
            sortedEntries.forEach((entry) => {
              const code = entry.accountCategoryCode?.trim();
              if (!code) return;
              if (!entriesByCode.has(code)) {
                entriesByCode.set(code, []);
              }
              entriesByCode.get(code)!.push(entry);
            });

            const overridesForLot = phaseOverrides[lot.key] ?? {};
            const phases: LotPhase[] = [];

            Object.values(KNOWN_PHASES).forEach((definition) => {
              const entriesForCode = entriesByCode.get(definition.code) ?? [];
              const servicesByName = new Map<string, BlueBookEntry[]>();
              entriesForCode.forEach((entry) => {
                const serviceName =
                  entry.accountCategoryName?.trim() ||
                  entry.serviceName?.trim() ||
                  'Unspecified Service';
                if (!servicesByName.has(serviceName)) {
                  servicesByName.set(serviceName, []);
                }
                servicesByName.get(serviceName)!.push(entry);
              });

              const phaseOverride = overridesForLot[definition.code];
              const serviceOverrides = phaseOverride?.services ?? {};

              const baseComplete = definition.serviceNames.length
                ? definition.serviceNames.every(
                  (name) => (servicesByName.get(name)?.length ?? 0) > 0
                )
                : entriesForCode.length > 0;

              const orderedServices: LotPhaseService[] = [];

              definition.serviceNames.forEach((name) => {
                const serviceEntries = servicesByName.get(name) ?? [];
                const baseLogged = serviceEntries.length > 0;
                const overrideLogged = serviceOverrides[name];
                const isLogged = overrideLogged ?? baseLogged;
                orderedServices.push({
                  name,
                  entries: serviceEntries,
                  baseLogged,
                  overrideStatus: overrideLogged,
                  isLogged,
                });
                servicesByName.delete(name);
              });

              servicesByName.forEach((serviceEntries, name) => {
                const baseLogged = serviceEntries.length > 0;
                const overrideLogged = serviceOverrides[name];
                const isLogged = overrideLogged ?? baseLogged;
                orderedServices.push({
                  name,
                  entries: serviceEntries,
                  baseLogged,
                  overrideStatus: overrideLogged,
                  isLogged,
                });
              });

              const servicesComplete = orderedServices.length
                ? orderedServices.every((service) => service.isLogged)
                : baseComplete;

              const overrideStatus = phaseOverride?.phase;
              phases.push({
                code: definition.code,
                title: definition.title,
                shorthand: definition.shorthand,
                baseComplete,
                overrideStatus,
                isComplete: overrideStatus ?? servicesComplete,
                matchingEntries: orderedServices.flatMap((service) => service.entries),
                services: orderedServices,
              });

              entriesByCode.delete(definition.code);
            });

            entriesByCode.forEach((entriesForCode, code) => {
              const servicesByName = new Map<string, BlueBookEntry[]>();
              entriesForCode.forEach((entry) => {
                const serviceName =
                  entry.accountCategoryName?.trim() ||
                  entry.serviceName?.trim() ||
                  'Unspecified Service';
                if (!servicesByName.has(serviceName)) {
                  servicesByName.set(serviceName, []);
                }
                servicesByName.get(serviceName)!.push(entry);
              });

              const phaseOverride = overridesForLot[code];
              const serviceOverrides = phaseOverride?.services ?? {};

              const orderedServices: LotPhaseService[] = Array.from(servicesByName.entries()).map(
                ([name, serviceEntries]) => {
                  const baseLogged = serviceEntries.length > 0;
                  const overrideLogged = serviceOverrides[name];
                  const isLogged = overrideLogged ?? baseLogged;
                  return {
                    name,
                    entries: serviceEntries,
                    baseLogged,
                    overrideStatus: overrideLogged,
                    isLogged,
                  };
                }
              );
              const baseComplete = orderedServices.every((service) => service.baseLogged);
              const servicesComplete = orderedServices.length
                ? orderedServices.every((service) => service.isLogged)
                : baseComplete;
              const overrideStatus = phaseOverride?.phase;
              const firstServiceName = orderedServices[0]?.name;
              phases.push({
                code,
                title: firstServiceName ? `${code} – ${firstServiceName}` : code,
                shorthand: code,
                baseComplete,
                overrideStatus,
                isComplete: overrideStatus ?? servicesComplete,
                matchingEntries: orderedServices.flatMap((service) => service.entries),
                services: orderedServices,
              });
            });

            const incompleteEntries = sortedEntries.filter((e) => (e.status || 'PENDING').toUpperCase() !== 'COMPLETE');
            const nextActivityDate = incompleteEntries.length
              ? Math.min(
                ...incompleteEntries.map((entry) =>
                  toTimestamp(entry.startDate ?? entry.createdAt)
                )
              )
              : (sortedEntries.length
                ? Math.min(
                  ...sortedEntries.map((entry) =>
                    toTimestamp(entry.startDate ?? entry.createdAt)
                  )
                )
                : Number.MAX_SAFE_INTEGER);
            const totalAmount = sortedEntries.reduce(
              (sum, entry) => sum + parseAmount(entry.amount),
              0
            );

            return {
              key: lot.key,
              lotLabel: lot.lotLabel,
              lotValue: lot.lotValue,
              entries: sortedEntries,
              phases,
              builderId: lot.builderId ?? community.builderId,
              modelPlanId: planSource?.modelPlanId ?? null,
              modelPlanName: planSource?.modelPlanName ?? null,
              modelPlanCode: planSource?.modelPlanCode ?? null,
              modelPlanSqft: planSource?.modelPlanSqft ?? null,
              nextActivityDate,
              totalAmount,
            };
          })
          .sort((a, b) => {
            // Sort by earliest start date first, then by lot number
            if (a.nextActivityDate !== b.nextActivityDate) {
              return a.nextActivityDate - b.nextActivityDate;
            }
            return a.lotLabel.localeCompare(b.lotLabel, undefined, { numeric: true, sensitivity: 'base' });
          });

        const nextActivityDate = community.entries.length
          ? Math.min(
            ...community.entries.map((entry) =>
              toTimestamp(entry.startDate ?? entry.checkDate)
            )
          )
          : Number.MAX_SAFE_INTEGER;

        const checkNumbers = Array.from(
          new Set(
            community.entries
              .map((entry) => entry.checkNumber?.trim())
              .filter((value): value is string => Boolean(value))
          )
        );

        const totalAmount = community.entries.reduce(
          (sum, entry) => sum + parseAmount(entry.amount),
          0
        );

        return {
          key: community.key,
          builderName: community.builderName,
          builderId: community.builderId,
          communityName: community.communityName,
          entries: community.entries,
          lots,
          nextActivityDate,
          checkNumbers,
          totalAmount,
        };
      })
      .sort((a, b) => {
        const nameA = a.communityName?.toLowerCase() ?? '';
        const nameB = b.communityName?.toLowerCase() ?? '';
        if (nameA && nameB) {
          const byName = nameA.localeCompare(nameB);
          if (byName !== 0) return byName;
        } else if (nameA || nameB) {
          return nameA ? -1 : 1;
        }
        return a.nextActivityDate - b.nextActivityDate;
      });
  }, [entries, phaseOverrides]);

  const [openCommunities, setOpenCommunities] = useState<Record<string, boolean>>({});
  const [openLots, setOpenLots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenCommunities(() => {
      const initial: Record<string, boolean> = {};
      communityGroups.slice(0, 3).forEach((group) => {
        initial[group.key] = true;
      });
      return initial;
    });
  }, [communityGroups]);

  useEffect(() => {
    setOpenLots((prev) => {
      const validKeys = new Set<string>();
      communityGroups.forEach((group) => {
        group.lots.forEach((lot) => validKeys.add(lot.key));
      });
      const next: Record<string, boolean> = {};
      let changed = false;
      Object.entries(prev).forEach(([key, value]) => {
        if (validKeys.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [communityGroups]);

  useEffect(() => {
    setPhaseOverrides((prev) => {
      const validLotKeys = new Set<string>();
      communityGroups.forEach((group) => {
        group.lots.forEach((lot) => validLotKeys.add(lot.key));
      });

      let changed = false;
      const next: PhaseOverrides = {};

      Object.entries(prev).forEach(([lotKey, phases]) => {
        if (!validLotKeys.has(lotKey)) {
          changed = true;
          return;
        }

        const nextPhases: Record<string, PhaseOverrideState> = {};
        Object.entries(phases).forEach(([phaseCode, value]) => {
          const normalized = normalizePhaseOverrideValue(value);
          if (normalized) {
            nextPhases[phaseCode] = normalized;
            if (normalized !== value) {
              changed = true;
            }
          } else {
            changed = true;
          }
        });

        if (Object.keys(nextPhases).length > 0) {
          next[lotKey] = nextPhases;
          if (nextPhases !== phases) {
            changed = true;
          }
        } else if (Object.keys(phases).length > 0) {
          changed = true;
        }
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (!changed) {
        if (prevKeys.length !== nextKeys.length) {
          changed = true;
        } else {
          for (const key of prevKeys) {
            if (prev[key] !== next[key]) {
              changed = true;
              break;
            }
          }
        }
      }

      return changed ? next : prev;
    });
  }, [communityGroups]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LOT_PHASE_STORAGE_KEY, JSON.stringify(phaseOverrides));
    } catch {
      // ignore storage errors
    }
  }, [phaseOverrides]);

  useEffect(() => {
    const validKeys = new Set<string>();
    communityGroups.forEach((group) => {
      group.lots.forEach((lot) => validKeys.add(lot.key));
    });

    setPendingPlanSelections((prev) => {
      let changed = false;
      const next: Record<string, string | null> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (validKeys.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setSavingPlanSelections((prev) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (validKeys.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setPlanErrors((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (validKeys.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [communityGroups]);

  useEffect(() => {
    if (editingEntry) {
      setFormState({
        lot: editingEntry.lot || '',
        startDate: editingEntry.startDate || '',
        status: editingEntry.status,
        invoiceNumber: editingEntry.invoiceNumber || '',
        amount: editingEntry.amount ? String(editingEntry.amount) : '',
        accountCategoryName: editingEntry.accountCategoryName || '',
        accountCategoryCode: editingEntry.accountCategoryCode || '',
        checkNumber: editingEntry.checkNumber || '',
        checkDate: editingEntry.checkDate || '',
        builderId: editingEntry.builderId || '',
        communityId: editingEntry.communityId || '',
        serviceId: editingEntry.serviceId || '',
      });
      setFormError(null);
    }
  }, [editingEntry]);

  const toggleCommunity = (key: string) => {
    setOpenCommunities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleLot = (key: string) => {
    setOpenLots((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleTogglePhase = useCallback(
    (
      lotKey: string,
      phaseCode: string,
      baseComplete: boolean,
      currentComplete: boolean
    ) => {
      setPhaseOverrides((prev) => {
        const prevLot = prev[lotKey];
        const prevPhase = prevLot?.[phaseCode];
        const desired = !currentComplete;

        const existingServices = prevPhase?.services;
        const servicesClone = existingServices && Object.keys(existingServices).length > 0
          ? { ...existingServices }
          : undefined;

        let nextPhase: PhaseOverrideState | undefined;
        if (desired === baseComplete) {
          nextPhase = servicesClone ? { services: servicesClone } : undefined;
        } else {
          nextPhase = {
            phase: desired,
            ...(servicesClone ? { services: servicesClone } : {}),
          };
        }

        if (!nextPhase) {
          if (!prevPhase) {
            return prev;
          }
          const nextLot = { ...(prevLot ?? {}) };
          delete nextLot[phaseCode];
          if (Object.keys(nextLot).length === 0) {
            const nextState = { ...prev };
            delete nextState[lotKey];
            return nextState;
          }
          return { ...prev, [lotKey]: nextLot };
        }

        if (
          prevPhase &&
          prevPhase.phase === nextPhase.phase &&
          areServiceOverridesEqual(prevPhase.services, nextPhase.services)
        ) {
          return prev;
        }

        const nextLot = { ...(prevLot ?? {}) };
        nextLot[phaseCode] = nextPhase;
        return { ...prev, [lotKey]: nextLot };
      });
    },
    []
  );

  const handleToggleServiceStatus = useCallback(
    (
      lotKey: string,
      phaseCode: string,
      serviceName: string,
      baseLogged: boolean,
      currentLogged: boolean
    ) => {
      setPhaseOverrides((prev) => {
        const prevLot = prev[lotKey];
        const prevPhase = prevLot?.[phaseCode];
        const desired = !currentLogged;

        const previousServices = prevPhase?.services ?? {};
        const nextServices = { ...previousServices };

        if (desired === baseLogged) {
          if (serviceName in nextServices) {
            delete nextServices[serviceName];
          } else {
            return prev;
          }
        } else if (nextServices[serviceName] !== desired) {
          nextServices[serviceName] = desired;
        } else {
          return prev;
        }

        const hasServices = Object.keys(nextServices).length > 0;
        const phaseOverrideValue = prevPhase?.phase;

        if (!hasServices && phaseOverrideValue === undefined) {
          if (!prevPhase) {
            return prev;
          }
          const nextLot = { ...(prevLot ?? {}) };
          delete nextLot[phaseCode];
          if (Object.keys(nextLot).length === 0) {
            const nextState = { ...prev };
            delete nextState[lotKey];
            return nextState;
          }
          return { ...prev, [lotKey]: nextLot };
        }

        const nextPhase: PhaseOverrideState = {
          ...(phaseOverrideValue !== undefined ? { phase: phaseOverrideValue } : {}),
          ...(hasServices ? { services: nextServices } : {}),
        };

        if (
          prevPhase &&
          prevPhase.phase === nextPhase.phase &&
          areServiceOverridesEqual(prevPhase.services, nextPhase.services)
        ) {
          return prev;
        }

        const nextLot = { ...(prevLot ?? {}) };
        nextLot[phaseCode] = nextPhase;
        return { ...prev, [lotKey]: nextLot };
      });
    },
    []
  );

  const handleLotPlanChange = useCallback(
    async (lot: LotSummary, nextPlanId: string | null) => {
      const normalizedNext = nextPlanId || null;

      if ((lot.modelPlanId ?? null) === normalizedNext || lot.entries.length === 0) {
        setPendingPlanSelections((prev) => {
          if (!(lot.key in prev)) return prev;
          const next = { ...prev };
          delete next[lot.key];
          return next;
        });
        return;
      }

      setPlanErrors((prev) => {
        if (!prev[lot.key]) return prev;
        const next = { ...prev };
        delete next[lot.key];
        return next;
      });
      setPendingPlanSelections((prev) => ({ ...prev, [lot.key]: normalizedNext }));
      setSavingPlanSelections((prev) => ({ ...prev, [lot.key]: true }));

      try {
        await Promise.all(
          lot.entries.map((entry) =>
            fetchJSON(`/api/blue-book/${entry.id}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ modelPlanId: normalizedNext }),
            })
          )
        );
        await mutate();
      } catch (err) {
        console.error('Failed to update model plan', err);
        setPlanErrors((prev) => ({
          ...prev,
          [lot.key]:
            err instanceof Error ? err.message : 'Failed to update model plan',
        }));
      } finally {
        setSavingPlanSelections((prev) => {
          if (!(lot.key in prev)) return prev;
          const next = { ...prev };
          delete next[lot.key];
          return next;
        });
        setPendingPlanSelections((prev) => {
          const next = { ...prev };
          delete next[lot.key];
          return next;
        });
      }
    },
    [mutate]
  );

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEntry) return;
    setSaving(true);
    setFormError(null);
    try {
      await fetchJSON(`/api/blue-book/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lot: formState.lot || null,
          startDate: formState.startDate || null,
          status: formState.status,
          invoiceNumber: formState.invoiceNumber || null,
          amount: formState.amount ? Number(formState.amount) : null,
          accountCategoryName: formState.accountCategoryName || null,
          accountCategoryCode: formState.accountCategoryCode || null,
          checkNumber: formState.checkNumber || null,
          checkDate: formState.checkDate || null,
        }),
      });
      await mutate();
      setEditingEntry(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unexpected error';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await fetchJSON('/api/blue-book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          builderId: formState.builderId,
          communityId: formState.communityId,
          serviceId: formState.serviceId || null,
          lot: formState.lot || null,
          startDate: formState.startDate || null,
          status: formState.status || 'PENDING',
          invoiceNumber: formState.invoiceNumber || null,
          amount: formState.amount ? Number(formState.amount) : null,
          accountCategoryName: formState.accountCategoryName || null,
          accountCategoryCode: formState.accountCategoryCode || null,
          checkNumber: formState.checkNumber || null,
          checkDate: formState.checkDate || null,
        }),
      });
      await mutate();
      setIsCreatingManual(false);
      setFormState({
        lot: '',
        startDate: '',
        status: 'PENDING',
        invoiceNumber: '',
        amount: '',
        accountCategoryName: '',
        accountCategoryCode: '',
        checkNumber: '',
        checkDate: '',
        builderId: '',
        communityId: '',
        serviceId: '',
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unexpected error';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEntry) return;

    // Fix: Allow if Admin OR if Manual (Admins must always see button)
    const isManual = editingEntry.source === 'manual';
    if (!isAdmin && !isManual) return;

    if (!confirm('Are you sure you want to delete this entry?')) return;

    setSaving(true);
    setFormError(null);
    try {
      await fetchJSON(`/api/blue-book/${editingEntry.id}`, {
        method: 'DELETE',
      });
      await mutate();
      setEditingEntry(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unexpected error';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  if (error) return (
    <>
      <PageHeader title="Blue Book" description="Project tracking and management" />
      <main className="px-6 py-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">Failed to load data</p>
        </div>
      </main>
    </>
  );

  return (
    <>
      <PageHeader title="Blue Book" description="Project tracking and management" />
      <main className="px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            className={`rounded-full border px-4 py-2 text-sm transition ${activeBuilderId === 'all'
              ? 'border-blue-500 bg-blue-500 text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
              }`}
            onClick={() => setActiveBuilderId('all')}
          >
            All Builders
          </button>
          {tabBuilderIds.map((builderId) => {
            const builder = availableBuilders.find((b) => b.id === builderId);
            if (!builder) return null;
            const isActive = activeBuilderId === builder.id;
            return (
              <button
                key={builder.id}
                className={`rounded-full border px-4 py-2 text-sm transition ${isActive
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                  }`}
                onClick={() => setActiveBuilderId(builder.id)}
              >
                {builder.name}
              </button>
            );
          })}
        </div>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by lot, invoice, category, or check #"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-900 dark:text-white"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'checkDate' | 'startDate')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-900 dark:text-white"
          >
            <option value="checkDate">Sort by Check Date</option>
            <option value="startDate">Sort by Start Date</option>
          </select>
        </div>

        {/* Manual Entry Button */}
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setIsCreatingManual(true)}
            className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 whitespace-nowrap"
          >
            + Manual Entry
          </button>
        </div>

        {isLoading && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400">Loading entries…</p>
          </div>
        )}

        {!isLoading && communityGroups.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400">No entries match your criteria.</p>
          </div>
        )}

        <div className="space-y-4">
          {communityGroups.map((group) => {
            const communityOpen = openCommunities[group.key];
            const totalLots = group.lots.length;
            const totalChecks = group.checkNumbers.length;
            const phaseCounts = group.lots.reduce(
              (acc, lot) => {
                acc.total += lot.phases.length;
                acc.complete += lot.phases.filter((phase) => phase.isComplete).length;
                return acc;
              },
              { total: 0, complete: 0 }
            );
            const phaseSummary =
              phaseCounts.total > 0
                ? ` · ${phaseCounts.complete}/${phaseCounts.total} phase${phaseCounts.total === 1 ? '' : 's'
                } logged`
                : '';

            return (
              <div
                key={group.key}
                className="rounded-lg border border-gray-200 bg-white shadow-sm transition dark:border-slate-700 dark:bg-slate-800"
              >
                <button
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                  onClick={() => toggleCommunity(group.key)}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {group.communityName || 'Unknown Community'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {`${group.builderName || 'Unknown Builder'} · ${totalLots} lot${totalLots === 1 ? '' : 's'
                        } · ${totalChecks} check${totalChecks === 1 ? '' : 's'}${phaseSummary}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <span>{formatNumberAmount(group.totalAmount)}</span>
                    <span>{communityOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {communityOpen && (
                  <div className="divide-y divide-gray-200 dark:divide-slate-700">
                    {group.lots.map((lot) => {
                      const lotOpen = openLots[lot.key];
                      const hasNextActivity =
                        Number.isFinite(lot.nextActivityDate) &&
                        lot.nextActivityDate !== Number.MAX_SAFE_INTEGER;
                      const nextActivityLabel = hasNextActivity
                        ? new Date(lot.nextActivityDate).toLocaleDateString()
                        : 'No activity scheduled';
                      const lotTotalAmount = lot.entries.reduce((sum, entry) => {
                        if (!entry.amount) return sum;
                        const numeric = Number(entry.amount);
                        return sum + (Number.isFinite(numeric) ? numeric : 0);
                      }, 0);
                      const planOptionsCandidates = lot.builderId
                        ? plansByBuilder[lot.builderId] ?? []
                        : [];
                      const planOptions =
                        planOptionsCandidates.length > 0 ? planOptionsCandidates : modelPlans;
                      const pendingPlanId = pendingPlanSelections[lot.key] ?? null;
                      const effectivePlanId =
                        pendingPlanId ?? lot.modelPlanId ?? null;
                      const selectedPlan =
                        effectivePlanId && planOptions.length
                          ? planOptions.find((plan) => plan.id === effectivePlanId) ??
                          modelPlans.find((plan) => plan.id === effectivePlanId) ??
                          null
                          : null;
                      const planName = selectedPlan?.name ?? lot.modelPlanName ?? '—';
                      const planCode = selectedPlan?.code ?? lot.modelPlanCode ?? '—';
                      const planSqft = selectedPlan?.sqft ?? lot.modelPlanSqft ?? '—';
                      const isSavingPlan = Boolean(savingPlanSelections[lot.key]);
                      const planError = planErrors[lot.key];
                      const phaseStatusText = lot.phases.length
                        ? `${lot.phases.filter((phase) => phase.isComplete).length}/${lot.phases.length
                        } phase${lot.phases.length === 1 ? '' : 's'} logged`
                        : 'No phases mapped yet';

                      return (
                        <div key={lot.key} className="bg-white dark:bg-slate-800">
                          <button
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-blue-50/40 dark:hover:bg-slate-700/40"
                            onClick={() => toggleLot(lot.key)}
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                Lot {lot.lotLabel}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {`Next activity: ${nextActivityLabel} · ${phaseStatusText}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-300">
                              <span>{formatNumberAmount(lotTotalAmount)}</span>
                              <span>{lotOpen ? '▲' : '▼'}</span>
                            </div>
                          </button>
                          {lotOpen && (
                            <div className="space-y-4 border-t border-gray-200 px-4 py-4 dark:border-slate-700">
                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                      Model Plan
                                    </div>
                                    {isSavingPlan && (
                                      <span className="text-xs text-blue-600 dark:text-blue-300">
                                        Saving…
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-3">
                                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                      Select Plan
                                      <select
                                        className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                        value={effectivePlanId ?? ''}
                                        onChange={(e) =>
                                          handleLotPlanChange(lot, e.target.value || null)
                                        }
                                        disabled={isSavingPlan || planOptions.length === 0}
                                      >
                                        <option value="">Unassigned</option>
                                        {planOptions.map((plan) => (
                                          <option key={plan.id} value={plan.id}>
                                            {plan.code
                                              ? `${plan.name} (${plan.code})`
                                              : plan.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    {planOptions.length === 0 && (
                                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        No model plans available for this builder.
                                      </p>
                                    )}
                                    {planError && (
                                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                        {planError}
                                      </p>
                                    )}
                                  </div>
                                  <div className="mt-4 space-y-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {planName}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Code: {planCode || '—'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Sq Ft: {planSqft || '—'}
                                    </p>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-gray-200 p-4 dark:border-slate-700 md:col-span-1 xl:col-span-2">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Phases
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    {lot.phases.length === 0 ? (
                                      <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs italic text-gray-500 dark:border-slate-600 dark:text-gray-400">
                                        No phases configured for this lot.
                                      </p>
                                    ) : (
                                      lot.phases.map((phase) => {
                                        const helperText =
                                          phase.overrideStatus !== undefined
                                            ? `Manually marked as ${phase.isComplete ? 'logged' : 'pending'
                                            }`
                                            : phase.baseComplete
                                              ? 'Logged from ingested data'
                                              : 'Pending';
                                        return (
                                          <label
                                            key={`${phase.code}-${phase.title}`}
                                            className="flex items-start gap-3 rounded-md border border-gray-100 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                                          >
                                            <input
                                              type="checkbox"
                                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                              checked={phase.isComplete}
                                              onChange={() =>
                                                handleTogglePhase(
                                                  lot.key,
                                                  phase.code,
                                                  phase.baseComplete,
                                                  phase.isComplete
                                                )
                                              }
                                            />
                                            <div className="flex flex-1 flex-col gap-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                  {phase.title}
                                                </span>
                                                {phase.overrideStatus !== undefined && (
                                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                                                    Manual
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {helperText}
                                              </p>
                                              <div className="space-y-1 border-l border-dashed border-gray-200 pl-3 dark:border-slate-600">
                                                {phase.services.length === 0 ? (
                                                  <p className="text-xs italic text-gray-400">
                                                    No services tracked for this phase.
                                                  </p>
                                                ) : (
                                                  phase.services.map((service) => {
                                                    const linkedChecks = service.entries
                                                      .map(
                                                        (entry) =>
                                                          entry.checkNumber || entry.invoiceNumber
                                                      )
                                                      .filter(Boolean)
                                                      .join(', ');
                                                    const serviceHelperText =
                                                      service.overrideStatus !== undefined
                                                        ? `Manually marked as ${service.isLogged ? 'logged' : 'pending'
                                                        }`
                                                        : service.baseLogged
                                                          ? 'Logged from ingested data'
                                                          : 'Pending';
                                                    const statusClasses = service.isLogged
                                                      ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800'
                                                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600';

                                                    return (
                                                      <div
                                                        key={`${phase.code}-${service.name}`}
                                                        className="flex items-start justify-between gap-3"
                                                      >
                                                        <div className="space-y-1">
                                                          <div className="flex items-center gap-2">
                                                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                                                              {service.name || 'Service'}
                                                            </p>
                                                            {service.overrideStatus !== undefined && (
                                                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-200">
                                                                Manual
                                                              </span>
                                                            )}
                                                          </div>
                                                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                            {serviceHelperText}
                                                          </p>
                                                          {linkedChecks ? (
                                                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                                              Linked: {linkedChecks}
                                                            </p>
                                                          ) : (
                                                            <p className="text-[11px] italic text-gray-400">
                                                              Pending
                                                            </p>
                                                          )}
                                                        </div>
                                                        <button
                                                          type="button"
                                                          aria-pressed={service.isLogged}
                                                          onClick={() =>
                                                            handleToggleServiceStatus(
                                                              lot.key,
                                                              phase.code,
                                                              service.name,
                                                              service.baseLogged,
                                                              service.isLogged
                                                            )
                                                          }
                                                          className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold transition ${statusClasses}`}
                                                        >
                                                          {service.isLogged ? 'Logged' : 'Pending'}
                                                        </button>
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            </div>
                                          </label>
                                        );
                                      })
                                    )}
                                  </div>
                                    )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-slate-700 dark:text-gray-400">
                                <span>Invoices &amp; Checks</span>
                                <span>{lot.entries.length} item{lot.entries.length === 1 ? '' : 's'}</span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-slate-700">
                                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-slate-900 dark:text-gray-400">
                                    <tr>
                                      <th className="px-4 py-2">Check #</th>
                                      <th className="px-4 py-2">Check Date</th>
                                      <th className="px-4 py-2">Category</th>
                                      <th className="px-4 py-2">Invoice</th>
                                      <th className="px-4 py-2">Amount</th>
                                      <th className="px-4 py-2">Status</th>
                                      <th className="px-4 py-2 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {lot.entries.map((entry) => (
                                      <tr key={entry.id} className="bg-white dark:bg-slate-900">
                                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                                          {entry.checkNumber || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                                          {entry.checkDate
                                            ? new Date(entry.checkDate).toLocaleDateString()
                                            : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                                          {entry.accountCategoryCode
                                            ? `${entry.accountCategoryCode} – ${entry.accountCategoryName || ''}`.trim()
                                            : entry.serviceName || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                                          {entry.invoiceNumber || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-900 dark:text-white">
                                          {formatAmount(entry.amount)}
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${entry.status === 'COMPLETE'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                }`}
                                            >
                                              {entry.status}
                                            </span>
                                            {entry.source === 'manual' && (
                                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                                ✏️ Manual
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <button
                                            className="text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                            onClick={() => setEditingEntry(entry)}
                                          >
                                            Edit
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            </div>
                      )
                    }
                        </div>
                );
                    })}
              </div>
            )
          }
              </div>
        );
          })}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200">
        <span>
          Page {page} of {totalPages} · {total} total entries
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            className="rounded-lg border border-gray-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => (canNext ? p + 1 : p))}
            disabled={!canNext}
            className="rounded-lg border border-gray-300 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600"
          >
            Next
          </button>
        </div>
      </div>
    </main >

      {/* Edit Entry Modal */ }
  {
    editingEntry && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Entry</h3>
                {editingEntry.source === 'manual' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    ✏️ Manual Entry
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Check {editingEntry.checkNumber || 'N/A'} · Invoice {editingEntry.invoiceNumber || 'N/A'}
              </p>
            </div>
            <button
              onClick={() => setEditingEntry(null)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              Close
            </button>
          </div>
          <form className="space-y-4 text-sm" onSubmit={handleSave}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Lot</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.lot}
                  onChange={(e) => setFormState((prev) => ({ ...prev, lot: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Start Date</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.startDate}
                  onChange={(e) => setFormState((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Status</span>
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.status}
                  onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETE">Complete</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Amount</span>
                <input
                  type="number"
                  step="0.01"
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.amount}
                  onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Invoice #</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.invoiceNumber}
                  onChange={(e) => setFormState((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Check #</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.checkNumber}
                  onChange={(e) => setFormState((prev) => ({ ...prev, checkNumber: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Check Date</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.checkDate}
                  onChange={(e) => setFormState((prev) => ({ ...prev, checkDate: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Account Category</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.accountCategoryName}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, accountCategoryName: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Category Code</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.accountCategoryCode}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, accountCategoryCode: e.target.value }))
                  }
                />
              </label>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-between gap-3">
              {/* Admin can ALWAYS delete. */}
              {isAdmin && (
                <button
                  type="button"
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  {saving ? 'Deleting…' : 'Delete Entry'}
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-slate-600"
                  onClick={() => setEditingEntry(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    )
  }

  {
    isCreatingManual && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Manual Entry</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add a new Blue Book entry manually
              </p>
            </div>
            <button
              onClick={() => setIsCreatingManual(false)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              Close
            </button>
          </div>
          <form className="space-y-4 text-sm" onSubmit={handleCreateManual}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">Builder *</span>
                <select
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.builderId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, builderId: e.target.value, communityId: '' }))}
                >
                  <option value="">Select Builder</option>
                  {availableBuilders.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">Community *</span>
                <select
                  required
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.communityId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, communityId: e.target.value }))}
                >
                  <option value="">Select Community</option>
                  {communities.filter(c => !formState.builderId || c.builderId === formState.builderId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-gray-600 dark:text-gray-300">Service (Optional)</span>
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.serviceId}
                  onChange={(e) => setFormState((prev) => ({ ...prev, serviceId: e.target.value }))}
                >
                  <option value="">Select Service</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Lot</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.lot}
                  onChange={(e) => setFormState((prev) => ({ ...prev, lot: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Start Date</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.startDate}
                  onChange={(e) => setFormState((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Status</span>
                <select
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.status}
                  onChange={(e) => setFormState((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETE">Complete</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Amount</span>
                <input
                  type="number"
                  step="0.01"
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.amount}
                  onChange={(e) => setFormState((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Invoice #</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.invoiceNumber}
                  onChange={(e) => setFormState((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Check #</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.checkNumber}
                  onChange={(e) => setFormState((prev) => ({ ...prev, checkNumber: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Check Date</span>
                <input
                  type="date"
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.checkDate}
                  onChange={(e) => setFormState((prev) => ({ ...prev, checkDate: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Account Category</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.accountCategoryName}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, accountCategoryName: e.target.value }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-600 dark:text-gray-300">Category Code</span>
                <input
                  className="rounded-lg border border-gray-300 px-3 py-2 dark:bg-slate-800 dark:text-white"
                  value={formState.accountCategoryCode}
                  onChange={(e) =>
                    setFormState((prev) => ({ ...prev, accountCategoryCode: e.target.value }))
                  }
                />
              </label>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-slate-600"
                onClick={() => setIsCreatingManual(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Creating…' : 'Create Entry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }
  </>
  );
}
