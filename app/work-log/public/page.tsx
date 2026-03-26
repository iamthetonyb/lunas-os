'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PublicWorkLogPage() {
  const { t } = useTranslation();

  // ── Form state ──
  const [submitted, setSubmitted] = useState(false);
  const [crewId, setCrewId] = useState<string>('');
  const [foremanId, setForemanId] = useState<string>('');
  const [date, setDate] = useState(todayISO());
  const [builderId, setBuilderId] = useState<string>('');
  const [communityId, setCommunityId] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('');
  const [selectedLots, setSelectedLots] = useState<string[]>([]);
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

  const createPublicLog = useMutation(api.workLogs.createPublic);

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

  // Resolve crew name for submitterName
  const selectedCrew = crews.find((c: any) => c._id === crewId);
  const submitterName = selectedCrew?.name ?? '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewId) { toast.error(t('workLog.crewRequired', 'Select a crew')); return; }
    if (!builderId) { toast.error(t('workLog.builderRequired', 'Select a builder')); return; }
    if (!serviceType) { toast.error(t('workLog.serviceRequired', 'Select a service type')); return; }
    if (selectedLots.length === 0) { toast.error(t('workLog.lotsRequired', 'Select at least one lot')); return; }
    if (isExtraWork && !extraDesc.trim()) { toast.error(t('workLog.extraDescRequired', 'Extra work description is required')); return; }

    setSubmitting(true);
    try {
      await createPublicLog({
        submitterName,
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
        supervisor: foremanId ? (foremen.find(f => f.id === foremanId)?.name) : undefined,
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
              setCrewId('');
              setForemanId('');
              setDate(todayISO());
              setBuilderId('');
              setCommunityId('');
              setServiceType('');
              setSelectedLots([]);
              setWorkExplanation('');
              setIsExtraWork(false);
              setExtraDesc('');
              setHoursWorked('');
              setNumWorkers('');
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
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">{t('workLog.publicTitle', 'Daily Work Log')}</h1>
          <p className="text-sm text-gray-500">{t('workLog.publicSubtitle', 'Submit your daily work tracker')}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-5">
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

          {/* ── Date ── */}
          <Field label={t('workLog.date', 'Date')}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="input-field" required />
          </Field>

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
