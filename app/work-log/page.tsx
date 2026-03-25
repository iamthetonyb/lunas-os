'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { PageHeader } from '@/components/page-header';
import { useConvexUser } from '@/hooks/useConvexUser';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const SERVICE_CHECKS = [
  'Frame Sweep', 'Paint Sweep', 'Carpet Sweep', 'Power Wash',
  'Stucco Pick Up', 'Exterior Pick Up',
] as const;

const SERVICE_TYPES = [
  'Final Clean', 'QA', 'Tubs / Windows', 'Touch Up Clean', 'Frame Sweep',
  'Rough Clean', 'Paint Sweep', 'NHO', 'FQI', 'Move In Clean',
  'After Carpet', 'Carpet Sweep', 'Power Wash', 'Stucco Pick Up',
  'Exterior Pick Up', 'Extra Sweep', 'Extra Clean', 'Other',
] as const;

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  SUBMITTED: { bg: 'bg-blue-100 text-blue-800', text: 'Submitted' },
  VERIFIED:  { bg: 'bg-green-100 text-green-800', text: 'Verified' },
  FLAGGED:   { bg: 'bg-red-100 text-red-800', text: 'Flagged' },
  DRAFT:     { bg: 'bg-gray-100 text-gray-600', text: 'Draft' },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

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
  userId,
  onVerify,
  onForemanVerify,
  onFlag,
}: {
  log: any;
  isAdmin: boolean;
  isForeman: boolean;
  userId: string | undefined;
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
        <td className="px-4 py-3 text-sm text-gray-700">
          {log.amount != null ? `$${Number(log.amount).toFixed(2)}` : '—'}
        </td>
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
            {/* Foreman verify button — show to foremen for submitted, un-foreman-verified logs */}
            {(isForeman || isAdmin) && status === 'SUBMITTED' && !log.foremanVerified && (
              <button
                onClick={(e) => { e.stopPropagation(); onForemanVerify(log._id); }}
                className="text-indigo-700 hover:text-indigo-900 font-medium text-xs"
              >{t('workLog.foremanApprove', 'Foreman Approve')}</button>
            )}
            {/* Admin verify — only after foreman verified */}
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
          <td colSpan={7} className="px-6 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {log.time && <Detail label={t('workLog.time', 'Time')} value={log.time} />}
              {log.crewLeader && <Detail label={t('workLog.crewLeader', 'Crew Leader')} value={log.crewLeader} />}
              {log.numWorkers != null && <Detail label={t('workLog.numWorkers', '# Workers')} value={String(log.numWorkers)} />}
              {log.supervisor && <Detail label={t('workLog.supervisor', 'Supervisor')} value={log.supervisor} />}
              {log.team && <Detail label={t('workLog.team', 'Team')} value={log.team} />}
              {log.sqft != null && <Detail label={t('workLog.sqft', 'Sqft')} value={String(log.sqft)} />}
              {log.windowCount != null && <Detail label={t('workLog.windowCount', 'Windows')} value={String(log.windowCount)} />}
              {log.hoursWorked != null && <Detail label={t('workLog.hoursWorked', 'Hours')} value={String(log.hoursWorked)} />}
              {log.subContractorName && <Detail label={t('workLog.subContractor', 'Sub-contractor')} value={log.subContractorName} />}
              {log.userName && <Detail label={t('workLog.loggedBy', 'Logged by')} value={log.userName} />}
              {log.serviceChecks?.length > 0 && <Detail label={t('workLog.serviceChecks', 'Service Checks')} value={log.serviceChecks.join(', ')} />}
              {log.workExplanation && <Detail label={t('workLog.workExplanation', 'Work Explanation')} value={log.workExplanation} />}
              {log.extraWorkDescription && <Detail label={t('workLog.extraWork', 'Extra work')} value={log.extraWorkDescription} />}
              {log.notes && <Detail label={t('workLog.notes', 'Notes')} value={log.notes} />}
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
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTime());
  const [communityId, setCommunityId] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('');
  const [serviceChecks, setServiceChecks] = useState<string[]>([]);
  const [lots, setLots] = useState('');
  const [sqft, setSqft] = useState('');
  const [amount, setAmount] = useState('');
  const [crewLeader, setCrewLeader] = useState('');
  const [numWorkers, setNumWorkers] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [team, setTeam] = useState('');
  const [workExplanation, setWorkExplanation] = useState('');
  const [isExtraWork, setIsExtraWork] = useState(false);
  const [extraDesc, setExtraDesc] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [subContractor, setSubContractor] = useState('');
  const [windowCount, setWindowCount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Data queries ──
  const communities = useQuery(api.queries.getCommunities, {}) ?? [];
  const stats = useQuery(api.workLogs.getStats, userId ? { callerUserId: userId } : 'skip');
  const logs = useQuery(api.workLogs.list, userId ? { callerUserId: userId, limit: 200 } : 'skip');

  // ── Mutations ──
  const createLog = useMutation(api.workLogs.create);
  const verifyLog = useMutation(api.workLogs.verify);
  const foremanVerifyLog = useMutation(api.workLogs.foremanVerify);
  const flagLog = useMutation(api.workLogs.flag);

  const toggleServiceCheck = (svc: string) => {
    setServiceChecks((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
    );
  };

  const resetForm = () => {
    setDate(todayISO());
    setTime(nowTime());
    setCommunityId('');
    setServiceType('');
    setServiceChecks([]);
    setLots('');
    setSqft('');
    setAmount('');
    setCrewLeader('');
    setNumWorkers('');
    setSupervisor('');
    setTeam('');
    setWorkExplanation('');
    setIsExtraWork(false);
    setExtraDesc('');
    setHoursWorked('');
    setSubContractor('');
    setWindowCount('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { toast.error(t('workLog.loginRequired', 'You must be logged in')); return; }
    if (!serviceType) { toast.error(t('workLog.serviceRequired', 'Select a service type')); return; }
    if (!lots.trim()) { toast.error(t('workLog.lotsRequired', 'Enter at least one lot')); return; }
    if (isExtraWork && !extraDesc.trim()) { toast.error(t('workLog.extraDescRequired', 'Extra work description is required')); return; }

    setSubmitting(true);
    try {
      const result = await createLog({
        userId,
        date,
        time: time || undefined,
        communityId: communityId ? (communityId as Id<'communities'>) : undefined,
        serviceType,
        serviceChecks: serviceChecks.length > 0 ? serviceChecks : undefined,
        lots: lots.trim(),
        sqft: sqft ? Number(sqft) : undefined,
        amount: amount ? Number(amount) : undefined,
        isExtraWork: isExtraWork || undefined,
        extraWorkDescription: isExtraWork ? extraDesc.trim() : undefined,
        workExplanation: workExplanation.trim() || undefined,
        hoursWorked: hoursWorked ? Number(hoursWorked) : undefined,
        subContractorName: subContractor.trim() || undefined,
        windowCount: windowCount ? Number(windowCount) : undefined,
        notes: notes.trim() || undefined,
        crewLeader: crewLeader.trim() || undefined,
        numWorkers: numWorkers ? Number(numWorkers) : undefined,
        supervisor: supervisor.trim() || undefined,
        team: team.trim() || undefined,
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

          {/* ── Header Row: Date, Time, Community ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label={t('workLog.date', 'Date')}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="input-field" required />
            </Field>
            <Field label={t('workLog.time', 'Time')}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="input-field" />
            </Field>
            <Field label={t('workLog.community', 'Community')}>
              <select value={communityId} onChange={(e) => setCommunityId(e.target.value)} className="input-field">
                <option value="">{t('workLog.selectCommunity', '-- Select --')}</option>
                {communities.map((c: any) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label={t('workLog.lots', 'Lot(s)')}>
              <input type="text" value={lots} onChange={(e) => setLots(e.target.value)}
                placeholder="13, 14, 15" className="input-field" required />
            </Field>
          </div>

          {/* ── Crew Info Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label={t('workLog.foreman', 'Foreman')}>
              <input type="text" value={session?.user?.name ?? ''} disabled
                className="input-field bg-gray-100 cursor-not-allowed" />
            </Field>
            <Field label={t('workLog.crewLeader', 'Crew Leader')}>
              <input type="text" value={crewLeader} onChange={(e) => setCrewLeader(e.target.value)}
                placeholder={t('workLog.optional', 'Optional')} className="input-field" />
            </Field>
            <Field label={t('workLog.supervisor', 'Supervisor')}>
              <input type="text" value={supervisor} onChange={(e) => setSupervisor(e.target.value)}
                placeholder={t('workLog.optional', 'Optional')} className="input-field" />
            </Field>
            <Field label={t('workLog.team', 'Team')}>
              <input type="text" value={team} onChange={(e) => setTeam(e.target.value)}
                placeholder={t('workLog.optional', 'Optional')} className="input-field" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label={t('workLog.numWorkers', '# Workers')}>
              <input type="number" value={numWorkers} onChange={(e) => setNumWorkers(e.target.value)}
                placeholder="0" className="input-field" min="0" />
            </Field>
            <Field label={t('workLog.subContractor', 'Sub-contractor')}>
              <input type="text" value={subContractor} onChange={(e) => setSubContractor(e.target.value)}
                placeholder={t('workLog.optional', 'Optional')} className="input-field" />
            </Field>
            <Field label={t('workLog.serviceType', 'Primary Service')}>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
                className="input-field" required>
                <option value="">{t('workLog.selectService', '-- Select --')}</option>
                {SERVICE_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* ── Service Checkboxes (paper form style) ── */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{t('workLog.serviceChecks', 'Service Checks')}</p>
            <div className="flex flex-wrap gap-3">
              {SERVICE_CHECKS.map((svc) => (
                <label key={svc} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceChecks.includes(svc)}
                    onChange={() => toggleServiceCheck(svc)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{svc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Contract Work Section ── */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{t('workLog.contractWork', 'Contract Work')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={t('workLog.sqft', 'Sq Ft')}>
                <input type="number" value={sqft} onChange={(e) => setSqft(e.target.value)}
                  placeholder={t('workLog.optional', 'Optional')} className="input-field" min="0" />
              </Field>
              <Field label={t('workLog.amount', 'Amount')}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder={t('workLog.optional', 'Optional')} className="input-field pl-7" min="0" step="0.01" />
                </div>
              </Field>
              {serviceType === 'Tubs / Windows' && (
                <Field label={t('workLog.windowCount', 'Window Count')}>
                  <input type="number" value={windowCount} onChange={(e) => setWindowCount(e.target.value)}
                    placeholder={t('workLog.optional', 'Optional')} className="input-field" min="0" />
                </Field>
              )}
            </div>
          </div>

          {/* ── Extra Work Section ── */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 border-amber-300">
                <Field label={t('workLog.extraDescription', 'Extra Work Description')}>
                  <textarea value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)}
                    rows={2} className="input-field" required />
                </Field>
                <Field label={t('workLog.hoursWorked', 'Hours Worked')}>
                  <input type="number" value={hoursWorked} onChange={(e) => setHoursWorked(e.target.value)}
                    className="input-field" min="0" step="0.5" />
                </Field>
              </div>
            )}
          </div>

          {/* ── Work Explanation ── */}
          <Field label={t('workLog.workExplanation', 'Explain Work Completed')}>
            <textarea value={workExplanation} onChange={(e) => setWorkExplanation(e.target.value)}
              rows={3} placeholder={t('workLog.workExplanationPlaceholder', 'Describe the work completed today...')}
              className="input-field" />
          </Field>

          {/* ── Notes ── */}
          <Field label={t('workLog.notes', 'Notes')}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder={t('workLog.optional', 'Optional')} className="input-field" />
          </Field>

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
                    t('workLog.amount', 'Amount'),
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
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('workLog.loading', 'Loading...')}
                  </td></tr>
                )}
                {logs && logs.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    {t('workLog.noLogs', 'No work logs yet. Submit your first entry above.')}
                  </td></tr>
                )}
                {logs?.map((log: any) => (
                  <LogRow
                    key={log._id}
                    log={log}
                    isAdmin={isAdmin}
                    isForeman={isForeman}
                    userId={userId as string | undefined}
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
