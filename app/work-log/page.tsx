'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { PageHeader } from '@/components/page-header';
import { useConvexUser } from '@/hooks/useConvexUser';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  SUBMITTED: { bg: 'bg-blue-100 text-blue-800', text: 'Submitted' },
  VERIFIED:  { bg: 'bg-green-100 text-green-800', text: 'Verified' },
  FLAGGED:   { bg: 'bg-red-100 text-red-800', text: 'Flagged' },
  DRAFT:     { bg: 'bg-gray-100 text-gray-600', text: 'Draft' },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Stat Pill ────────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      <span>{value}</span>
      <span className="text-xs font-normal opacity-75">{label}</span>
    </div>
  );
}

// ── Expandable Row ───────────────────────────────────────────────────
function LogRow({
  log,
  isAdmin,
  isForeman,
  onVerify,
  onForemanVerify,
  onFlag,
}: {
  log: any;
  isAdmin: boolean;
  isForeman: boolean;
  onVerify: (id: Id<'workLogs'>) => void;
  onForemanVerify: (id: Id<'workLogs'>) => void;
  onFlag: (id: Id<'workLogs'>) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const status = log.status ?? 'DRAFT';
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.DRAFT;
  const borderClass =
    status === 'VERIFIED' ? 'border-l-4 border-l-green-500' :
    status === 'FLAGGED'  ? 'border-l-4 border-l-red-400' : '';

  return (
    <>
      <tr
        className={`hover:bg-gray-50 cursor-pointer ${borderClass}`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{log.date}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{log.communityName ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {log.serviceType}
          {log.isExtraWork && <span className="ml-1 text-amber-600 font-bold">*</span>}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{log.lots}</td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badge.bg}`}>
              {badge.text}
            </span>
            {log.foremanVerified && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                {t('workLog.foremanVerified', 'Foreman OK')}
              </span>
            )}
            {status === 'FLAGGED' && log.flagReason && (
              <span className="text-xs text-red-500" title={log.flagReason}>&#9888; {log.flagReason}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm">
          <div className="flex flex-col gap-1">
            {(isForeman || isAdmin) && status === 'SUBMITTED' && !log.foremanVerified && (
              <button
                onClick={(e) => { e.stopPropagation(); onForemanVerify(log._id); }}
                className="text-indigo-700 hover:text-indigo-900 font-medium text-xs"
              >{t('workLog.foremanApprove', 'Foreman Approve')}</button>
            )}
            {isAdmin && status === 'SUBMITTED' && log.foremanVerified && (
              <button
                onClick={(e) => { e.stopPropagation(); onVerify(log._id); }}
                className="text-green-700 hover:text-green-900 font-medium text-xs"
              >{t('workLog.verify', 'Verify')}</button>
            )}
            {isAdmin && status === 'SUBMITTED' && (
              <button
                onClick={(e) => { e.stopPropagation(); onFlag(log._id); }}
                className="text-red-600 hover:text-red-800 font-medium text-xs"
              >{t('workLog.flag', 'Flag')}</button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {log.crewLeader && <Detail label={t('workLog.crewLeader', 'Crew Leader')} value={log.crewLeader} />}
              {log.numWorkers != null && <Detail label={t('workLog.numWorkers', '# Workers')} value={String(log.numWorkers)} />}
              {log.hoursWorked != null && <Detail label={t('workLog.hoursWorked', 'Hours')} value={String(log.hoursWorked)} />}
              {log.userName && <Detail label={t('workLog.loggedBy', 'Logged by')} value={log.userName} />}
              {log.builderName && <Detail label={t('workLog.builder', 'Builder')} value={log.builderName} />}
              {log.workExplanation && <Detail label={t('workLog.workExplanation', 'Work Explanation')} value={log.workExplanation} />}
              {log.extraWorkDescription && <Detail label={t('workLog.extraWork', 'Extra work')} value={log.extraWorkDescription} />}
              {log.flagReason && <Detail label={t('workLog.flagReason', 'Flag reason')} value={log.flagReason} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-gray-900">{value}</p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function WorkLogPage() {
  const { t } = useTranslation();
  const { data: session } = useConvexUser();
  const userId = session?.user?.id as Id<'users'> | undefined;
  const userRole = (session?.user?.role ?? '').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'BACKOFFICE';
  const isForeman = userRole === 'FOREMAN';

  // ── Form state ──
  const [crewId, setCrewId] = useState<string>('');
  const [foremanId, setForemanId] = useState<string>('');
  const [date, setDate] = useState(todayISO());
  const [builderId, setBuilderId] = useState<string>('');
  const [communityId, setCommunityId] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('');
  const [selectedLots, setSelectedLots] = useState<string[]>([]);
  const [crewLeader, setCrewLeader] = useState('');
  const [workExplanation, setWorkExplanation] = useState('');
  const [isExtraWork, setIsExtraWork] = useState(false);
  const [extraDesc, setExtraDesc] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [numWorkers, setNumWorkers] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Data: system dropdowns ──
  const crews = useQuery(api.queries.getCrews, {}) ?? [];
  const builders = useQuery(api.queries.getBuilders, {}) ?? [];
  const communities = useQuery(
    api.queries.getCommunitiesByBuilder,
    builderId ? { builderId: builderId as Id<'builders'> } : 'skip'
  ) ?? [];
  const communityLots = useQuery(
    api.communityLots.byCommunity,
    communityId ? { communityId: communityId as Id<'communities'> } : 'skip'
  ) ?? [];
  const dbServices = useQuery(api.queries.getServices, {}) ?? [];
  const stats = useQuery(api.workLogs.getStats, userId ? { callerUserId: userId } : 'skip');
  const logs = useQuery(api.workLogs.list, userId ? { callerUserId: userId, limit: 200 } : 'skip');

  // Foremen from crews (deduplicated)
  const foremen = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const c of crews) {
      if (c.foremanId && c.foremanName && !seen.has(c.foremanId)) {
        seen.add(c.foremanId);
        result.push({ id: c.foremanId, name: c.foremanName });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [crews]);

  // Service names from DB
  const serviceNames = useMemo(() => {
    const names = dbServices.map((s: any) => s.name).filter(Boolean);
    return names.length > 0 ? names.sort() : [];
  }, [dbServices]);

  // Lot numbers from communityLots
  const availableLots = useMemo(() => {
    const lotNums = communityLots
      .map((l: any) => l.lotNumber)
      .filter(Boolean) as string[];
    return [...new Set(lotNums)].sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [communityLots]);

  // ── Mutations ──
  const createLog = useMutation(api.workLogs.create);
  const verifyLog = useMutation(api.workLogs.verify);
  const foremanVerifyLog = useMutation(api.workLogs.foremanVerify);
  const flagLog = useMutation(api.workLogs.flag);

  const toggleLot = (lot: string) => {
    setSelectedLots((prev) =>
      prev.includes(lot) ? prev.filter((l) => l !== lot) : [...prev, lot]
    );
  };

  const handleBuilderChange = (id: string) => {
    setBuilderId(id);
    setCommunityId('');
    setSelectedLots([]);
  };

  const handleCommunityChange = (id: string) => {
    setCommunityId(id);
    setSelectedLots([]);
  };

  const resetForm = () => {
    setCrewId('');
    setForemanId('');
    setDate(todayISO());
    setBuilderId('');
    setCommunityId('');
    setServiceType('');
    setSelectedLots([]);
    setCrewLeader('');
    setWorkExplanation('');
    setIsExtraWork(false);
    setExtraDesc('');
    setHoursWorked('');
    setNumWorkers('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { toast.error(t('workLog.loginRequired', 'You must be logged in')); return; }
    if (!crewId) { toast.error(t('workLog.crewRequired', 'Select a crew')); return; }
    if (!builderId) { toast.error(t('workLog.builderRequired', 'Select a builder')); return; }
    if (!serviceType) { toast.error(t('workLog.serviceRequired', 'Select a service type')); return; }
    if (selectedLots.length === 0) { toast.error(t('workLog.lotsRequired', 'Select at least one lot')); return; }
    if (isExtraWork && !extraDesc.trim()) { toast.error(t('workLog.extraDescRequired', 'Extra work description is required')); return; }

    setSubmitting(true);
    try {
      const result = await createLog({
        userId,
        date,
        builderId: builderId as Id<'builders'>,
        communityId: communityId ? (communityId as Id<'communities'>) : undefined,
        serviceType,
        lots: selectedLots.join(', '),
        isExtraWork: isExtraWork || undefined,
        extraWorkDescription: isExtraWork ? extraDesc.trim() : undefined,
        workExplanation: workExplanation.trim() || undefined,
        hoursWorked: hoursWorked ? Number(hoursWorked) : undefined,
        numWorkers: isExtraWork && numWorkers ? Number(numWorkers) : undefined,
        crewLeader: crewLeader.trim() || undefined,
        supervisor: foremanId ? (foremen.find(f => f.id === foremanId)?.name) : undefined,
      });

      if (result.extraWorkJobRequestId) {
        toast.info(t('workLog.extraWorkRouted', 'Extra work auto-submitted for admin review'));
      }
      if (result.assignmentValidated === false) {
        toast.warning(t('workLog.noAssignment', "This work doesn't match any assignment — it will be flagged for review"));
      } else {
        toast.success(t('workLog.logSubmitted', 'Work log submitted'));
      }
      resetForm();
    } catch (err: any) {
      toast.error(err?.message ?? t('workLog.submitError', 'Failed to submit work log'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (id: Id<'workLogs'>) => {
    if (!userId) return;
    try {
      await verifyLog({ id, verifiedBy: userId });
      toast.success(t('workLog.logVerified', 'Work log verified + Blue Book entry created'));
    } catch (err: any) {
      toast.error(err?.message ?? 'Verification failed');
    }
  };

  const handleForemanVerify = async (id: Id<'workLogs'>) => {
    if (!userId) return;
    try {
      await foremanVerifyLog({ id, foremanUserId: userId });
      toast.success(t('workLog.foremanVerifiedSuccess', 'Foreman verification complete'));
    } catch (err: any) {
      toast.error(err?.message ?? 'Foreman verification failed');
    }
  };

  const handleFlag = async (id: Id<'workLogs'>) => {
    const reason = prompt(t('workLog.flagReasonPrompt', 'Flag reason:'));
    if (!reason?.trim()) return;
    try {
      await flagLog({ id, reason: reason.trim() });
      toast.success(t('workLog.logFlagged', 'Work log flagged'));
    } catch (err: any) {
      toast.error(err?.message ?? 'Flagging failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title={t('workLog.title', 'Work Log')} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Stats Bar ── */}
        {stats && (
          <div className="flex flex-wrap gap-3">
            <StatPill label={t('workLog.total', 'Total')} value={stats.total} color="bg-gray-100 text-gray-700" />
            <StatPill label={t('workLog.submitted', 'Submitted')} value={stats.submitted} color="bg-blue-50 text-blue-700" />
            <StatPill label={t('workLog.pendingForeman', 'Pending Foreman')} value={stats.pendingForeman} color="bg-indigo-50 text-indigo-700" />
            <StatPill label={t('workLog.verified', 'Verified')} value={stats.verified} color="bg-green-50 text-green-700" />
            <StatPill label={t('workLog.flagged', 'Flagged')} value={stats.flagged} color="bg-red-50 text-red-700" />
          </div>
        )}

        {/* ── Entry Form ── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">{t('workLog.newEntry', 'New Entry')}</h2>

          {/* ── Crew + Foreman ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('workLog.crew', 'Crew')}>
              <select value={crewId} onChange={(e) => setCrewId(e.target.value)}
                className="input-field" required>
                <option value="">{t('workLog.selectCrew', '-- Select Crew --')}</option>
                {crews.map((c: any) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('workLog.foreman', 'Foreman')}>
              <select value={foremanId} onChange={(e) => setForemanId(e.target.value)}
                className="input-field">
                <option value="">{t('workLog.selectForeman', '-- Select Foreman --')}</option>
                {foremen.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* ── Date + Crew Leader ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('workLog.date', 'Date')}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="input-field" required />
            </Field>
            <Field label={t('workLog.crewLeader', 'Crew Leader')}>
              <input type="text" value={crewLeader} onChange={(e) => setCrewLeader(e.target.value)}
                placeholder={t('workLog.optional', 'Optional')} className="input-field" />
            </Field>
          </div>

          {/* ── Builder → Community (cascading) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('workLog.builder', 'Builder')}>
              <select value={builderId} onChange={(e) => handleBuilderChange(e.target.value)}
                className="input-field" required>
                <option value="">{t('workLog.selectBuilder', '-- Select Builder --')}</option>
                {builders.map((b: any) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('workLog.community', 'Community')}>
              <select value={communityId} onChange={(e) => handleCommunityChange(e.target.value)}
                className="input-field" disabled={!builderId}>
                <option value="">{builderId ? t('workLog.selectCommunity', '-- Select --') : t('workLog.selectBuilderFirst', '-- Select builder first --')}</option>
                {communities.map((c: any) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* ── Lot Selection (pill buttons from system data) ── */}
          {communityId && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{t('workLog.selectLots', 'Select Lot(s)')}</p>
              {availableLots.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableLots.map((lot) => (
                    <button
                      key={lot}
                      type="button"
                      onClick={() => toggleLot(lot)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        selectedLots.includes(lot)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {lot}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">{t('workLog.noLotsFound', 'No lots found for this community')}</p>
              )}
              {selectedLots.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('workLog.selectedLots', 'Selected')}: {selectedLots.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* ── Primary Service (from DB) ── */}
          <Field label={t('workLog.serviceType', 'Primary Service')}>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
              className="input-field" required>
              <option value="">{t('workLog.selectService', '-- Select --')}</option>
              {serviceNames.map((s: string) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          {/* ── Work Explanation ── */}
          <Field label={t('workLog.workExplanation', 'Explain Work Completed')}>
            <textarea value={workExplanation} onChange={(e) => setWorkExplanation(e.target.value)}
              rows={3} placeholder={t('workLog.workExplanationPlaceholder', 'Describe the work completed today...')}
              className="input-field" />
          </Field>

          {/* ── Extra Work ── */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isExtraWork} onChange={(e) => setIsExtraWork(e.target.checked)}
                  className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full
                  peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                  after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
              <span className="text-sm font-semibold text-gray-800">
                {t('workLog.extraWork', 'Extra Work')}
              </span>
              <span className="text-xs text-amber-600">
                {t('workLog.extraWorkNote', 'Auto-routes to admin for approval')}
              </span>
            </div>

            {isExtraWork && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-4 border-l-2 border-amber-300">
                <Field label={t('workLog.extraDescription', 'Extra Work Description')}>
                  <textarea value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)}
                    rows={2} className="input-field" required />
                </Field>
                <Field label={t('workLog.hoursWorked', 'Hours Worked')}>
                  <input type="number" value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)}
                    className="input-field" min="0" step="0.5" />
                </Field>
                <Field label={t('workLog.numWorkers', '# Workers')}>
                  <input type="number" value={numWorkers} onChange={(e) => setNumWorkers(e.target.value)}
                    placeholder="0" className="input-field" min="0" />
                </Field>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm">
              {submitting ? t('workLog.submitting', 'Submitting...') : t('workLog.submit', 'Submit Log')}
            </button>
          </div>
        </form>

        {/* ── Log History ── */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('workLog.history', 'Log History')}</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    t('workLog.date', 'Date'),
                    t('workLog.community', 'Community'),
                    t('workLog.service', 'Service'),
                    t('workLog.lots', 'Lots'),
                    t('workLog.status', 'Status'),
                    t('workLog.actions', 'Actions'),
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs === undefined && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('workLog.loading', 'Loading...')}
                  </td></tr>
                )}
                {logs && logs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('workLog.noLogs', 'No work logs yet. Submit your first entry above.')}
                  </td></tr>
                )}
                {logs?.map((log: any) => (
                  <LogRow
                    key={log._id}
                    log={log}
                    isAdmin={isAdmin}
                    isForeman={isForeman}
                    onVerify={handleVerify}
                    onForemanVerify={handleForemanVerify}
                    onFlag={handleFlag}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Field wrapper ────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
