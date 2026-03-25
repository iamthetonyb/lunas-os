'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
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

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

export default function PublicWorkLogPage() {
  const { t } = useTranslation();

  // ── Form state ──
  const [submitted, setSubmitted] = useState(false);
  const [submitterName, setSubmitterName] = useState('');
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

  // ── Data ──
  const communities = useQuery(api.queries.getCommunities, {}) ?? [];
  const createPublicLog = useMutation(api.workLogs.createPublic);

  const toggleServiceCheck = (svc: string) => {
    setServiceChecks((prev) =>
      prev.includes(svc) ? prev.filter((s) => s !== svc) : [...prev, svc]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitterName.trim()) { toast.error(t('workLog.nameRequired', 'Name is required')); return; }
    if (!serviceType) { toast.error(t('workLog.serviceRequired', 'Select a service type')); return; }
    if (!lots.trim()) { toast.error(t('workLog.lotsRequired', 'Enter at least one lot')); return; }
    if (isExtraWork && !extraDesc.trim()) { toast.error(t('workLog.extraDescRequired', 'Extra work description is required')); return; }

    setSubmitting(true);
    try {
      await createPublicLog({
        submitterName: submitterName.trim(),
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
      toast.success(t('workLog.publicSubmitSuccess', 'Work log submitted successfully'));
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message ?? t('workLog.submitError', 'Failed to submit work log'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('workLog.publicSubmitSuccess', 'Work log submitted successfully')}</h2>
          <p className="text-gray-600 mb-6">{t('workLog.publicThankYou', 'Thank you for submitting your daily work log.')}</p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSubmitterName('');
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
            }}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            {t('workLog.submitAnother', 'Submit Another')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header — no nav, no auth required */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">{t('workLog.publicTitle', 'Daily Work Log')}</h1>
          <p className="text-sm text-gray-500">{t('workLog.publicSubtitle', 'Submit your daily work tracker')}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
          {/* ── Your Name ── */}
          <Field label={t('workLog.yourName', 'Your Name')}>
            <input type="text" value={submitterName} onChange={(e) => setSubmitterName(e.target.value)}
              placeholder={t('workLog.yourName', 'Your Name')} className="input-field" required />
          </Field>

          {/* ── Date, Time, Community, Lots ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* ── Crew Info ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('workLog.crewLeader', 'Crew Leader')}>
              <input type="text" value={crewLeader} onChange={(e) => setCrewLeader(e.target.value)}
                placeholder={t('workLog.optional', 'Optional')} className="input-field" />
            </Field>
            <Field label={t('workLog.numWorkers', '# Workers')}>
              <input type="number" value={numWorkers} onChange={(e) => setNumWorkers(e.target.value)}
                placeholder="0" className="input-field" min="0" />
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

          {/* ── Primary Service ── */}
          <Field label={t('workLog.serviceType', 'Primary Service')}>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}
              className="input-field" required>
              <option value="">{t('workLog.selectService', '-- Select --')}</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          {/* ── Service Checkboxes ── */}
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

          {/* ── Contract Work ── */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">{t('workLog.contractWork', 'Contract Work')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>
          </div>

          {/* ── Sub-contractor ── */}
          <Field label={t('workLog.subContractor', 'Sub-contractor')}>
            <input type="text" value={subContractor} onChange={(e) => setSubContractor(e.target.value)}
              placeholder={t('workLog.optional', 'Optional')} className="input-field" />
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
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
