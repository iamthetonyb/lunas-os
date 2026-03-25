import { Id } from "@/convex/_generated/dataModel";

export type BlueBookEntry = {
    id: string;
    _id: string;
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
    startDateNum?: number | null;
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
    billingStatus?: string | null;
    source?: string | null;
    jobRequestId?: string | null;
    jobRequestServiceId?: string | null;
    createdAt: number;
    updatedAt?: number;
    assignedForemanName?: string | null;
    crewName?: string | null;
};

export type Builder = {
    _id: string;
    name: string;
    active?: boolean;
};

export type ModelPlan = {
    _id: string;
    builderId: string | null;
    name: string;
    code: string | null;
    sqft: string | null;
};

export type PhaseDefinition = {
    _id: string;
    code: string;
    title: string;
    shorthand: string;
    serviceNames: string[];
    sortOrder: number;
    active: boolean;
};

export type LotPhaseService = {
    name: string;
    entries: BlueBookEntry[];
    baseLogged: boolean;
    overrideStatus: boolean | undefined;
    isLogged: boolean;
};

export type LotPhase = {
    code: string;
    isComplete: boolean;
    baseComplete: boolean;
    overrideStatus: boolean | undefined;
    matchingEntries: BlueBookEntry[];
    title: string;
    shorthand: string;
    services: LotPhaseService[];
};

export type PhaseOverrideState = {
    phase?: boolean;
    services?: Record<string, boolean>;
};

export type PhaseOverrides = Record<string, Record<string, PhaseOverrideState>>;

export type LotSummary = {
    key: string;
    lot: string;
    entries: BlueBookEntry[];
    phases: LotPhase[];
    modelPlanCode: string | null;
    modelPlanSqft: string | null;
};

export type CommunityGroup = {
    communityName: string;
    communityId: string | null;
    lots: LotSummary[];
    totalEntries: number;
    completedEntries: number;
};

export type BlueBookSort = "community" | "checkDate" | "startDate";

export type BlueBookFilters = {
    builderId: string | null;
    status: string | null;
    invoiced: boolean | null;
    search: string;
    sort: BlueBookSort;
    startDateFrom: string | null;
    startDateTo: string | null;
};
