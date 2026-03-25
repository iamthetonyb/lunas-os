'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// ── LUNAS-OS permission sections (GHL-style) ────────────────────────
export type PermissionKey = string;

export interface PermissionDef {
    key: PermissionKey;
    labelEn: string;
    labelEs: string;
}

export interface SectionDef {
    id: string;
    labelEn: string;
    labelEs: string;
    icon: string;
    permissions: PermissionDef[];
}

export const PERMISSION_SECTIONS: SectionDef[] = [
    {
        id: 'dashboard',
        labelEn: 'Dashboard',
        labelEs: 'Panel',
        icon: '📊',
        permissions: [
            { key: 'dashboard.view', labelEn: 'View dashboard', labelEs: 'Ver panel' },
            { key: 'dashboard.viewMetrics', labelEn: 'View performance metrics', labelEs: 'Ver métricas de rendimiento' },
        ],
    },
    {
        id: 'schedule',
        labelEn: 'Schedule',
        labelEs: 'Programación',
        icon: '📅',
        permissions: [
            { key: 'schedule.view', labelEn: 'View schedule', labelEs: 'Ver programación' },
            { key: 'schedule.manage', labelEn: 'Manage & assign jobs', labelEs: 'Gestionar y asignar trabajos' },
            { key: 'schedule.complete', labelEn: 'Mark jobs complete', labelEs: 'Marcar trabajos completos' },
        ],
    },
    {
        id: 'dispatch',
        labelEn: 'Dispatch',
        labelEs: 'Despacho',
        icon: '🚚',
        permissions: [
            { key: 'dispatch.view', labelEn: 'View dispatch batches', labelEs: 'Ver lotes de despacho' },
            { key: 'dispatch.manage', labelEn: 'Create & manage batches', labelEs: 'Crear y gestionar lotes' },
        ],
    },
    {
        id: 'intake',
        labelEn: 'Intake',
        labelEs: 'Recepción',
        icon: '📝',
        permissions: [
            { key: 'intake.view', labelEn: 'View job requests', labelEs: 'Ver solicitudes de trabajo' },
            { key: 'intake.create', labelEn: 'Create new requests', labelEs: 'Crear nuevas solicitudes' },
            { key: 'intake.manage', labelEn: 'Edit & delete requests', labelEs: 'Editar y eliminar solicitudes' },
        ],
    },
    {
        id: 'blueBook',
        labelEn: 'Blue Book',
        labelEs: 'Libro Azul',
        icon: '📘',
        permissions: [
            { key: 'blueBook.view', labelEn: 'View entries', labelEs: 'Ver entradas' },
            { key: 'blueBook.manage', labelEn: 'Create & edit entries', labelEs: 'Crear y editar entradas' },
            { key: 'blueBook.viewAmounts', labelEn: 'View amounts & checks', labelEs: 'Ver montos y cheques' },
        ],
    },
    {
        id: 'invoicing',
        labelEn: 'Invoicing',
        labelEs: 'Facturación',
        icon: '💰',
        permissions: [
            { key: 'invoicing.view', labelEn: 'View invoices', labelEs: 'Ver facturas' },
            { key: 'invoicing.manage', labelEn: 'Create & manage invoices', labelEs: 'Crear y gestionar facturas' },
        ],
    },
    {
        id: 'import',
        labelEn: 'Import',
        labelEs: 'Importar',
        icon: '📥',
        permissions: [
            { key: 'import.upload', labelEn: 'Upload & import files', labelEs: 'Subir e importar archivos' },
            { key: 'import.viewHistory', labelEn: 'View import history', labelEs: 'Ver historial de importación' },
            { key: 'import.delete', labelEn: 'Delete imports', labelEs: 'Eliminar importaciones' },
        ],
    },
    {
        id: 'contracts',
        labelEn: 'Contracts / Settings',
        labelEs: 'Contratos / Configuración',
        icon: '⚙️',
        permissions: [
            { key: 'contracts.viewBuilders', labelEn: 'View builders & communities', labelEs: 'Ver constructores y comunidades' },
            { key: 'contracts.manageBuilders', labelEn: 'Manage builders & communities', labelEs: 'Gestionar constructores y comunidades' },
            { key: 'contracts.viewRates', labelEn: 'View contract rates', labelEs: 'Ver tarifas de contrato' },
            { key: 'contracts.manageRates', labelEn: 'Manage contract rates', labelEs: 'Gestionar tarifas de contrato' },
            { key: 'contracts.manageServices', labelEn: 'Manage services', labelEs: 'Gestionar servicios' },
            { key: 'contracts.manageModelPlans', labelEn: 'Manage model plans & lots', labelEs: 'Gestionar planos y lotes' },
        ],
    },
    {
        id: 'users',
        labelEn: 'User Management',
        labelEs: 'Gestión de Usuarios',
        icon: '👥',
        permissions: [
            { key: 'users.view', labelEn: 'View all users', labelEs: 'Ver todos los usuarios' },
            { key: 'users.manage', labelEn: 'Create & edit users', labelEs: 'Crear y editar usuarios' },
            { key: 'users.managePermissions', labelEn: 'Manage user permissions', labelEs: 'Gestionar permisos de usuario' },
            { key: 'users.manageOrgs', labelEn: 'Manage organizations', labelEs: 'Gestionar organizaciones' },
        ],
    },
    {
        id: 'workLog',
        labelEn: 'Work Log',
        labelEs: 'Registro de Trabajo',
        icon: '📋',
        permissions: [
            { key: 'workLog.view', labelEn: 'View work logs', labelEs: 'Ver registros de trabajo' },
            { key: 'workLog.submit', labelEn: 'Submit work logs', labelEs: 'Enviar registros de trabajo' },
            { key: 'workLog.verify', labelEn: 'Verify & flag logs', labelEs: 'Verificar y marcar registros' },
        ],
    },
    {
        id: 'ai',
        labelEn: 'AI Assistant',
        labelEs: 'Asistente IA',
        icon: '🤖',
        permissions: [
            { key: 'ai.use', labelEn: 'Use AI assistant', labelEs: 'Usar asistente IA' },
            { key: 'ai.viewDecisions', labelEn: 'View AI decision log', labelEs: 'Ver registro de decisiones IA' },
        ],
    },
];

// ── Permission state type ────────────────────────────────────────────
export type SectionPermissions = {
    enabled: boolean;
    permissions: Record<string, boolean>;
};
export type PermissionsState = Record<string, SectionPermissions>;

// Default: ADMIN gets everything, others get minimal
export function getDefaultPermissions(role: string): PermissionsState {
    const state: PermissionsState = {};
    for (const section of PERMISSION_SECTIONS) {
        const isAdmin = role === 'ADMIN';
        state[section.id] = {
            enabled: isAdmin,
            permissions: Object.fromEntries(
                section.permissions.map((p) => [p.key, isAdmin])
            ),
        };
    }
    // Non-admin defaults: dashboard view, intake view/create, schedule view
    if (role !== 'ADMIN') {
        state.dashboard = { enabled: true, permissions: { 'dashboard.view': true, 'dashboard.viewMetrics': false } };
        state.schedule = { enabled: true, permissions: { 'schedule.view': true, 'schedule.manage': false, 'schedule.complete': role === 'FOREMAN' } };
        state.intake = { enabled: true, permissions: { 'intake.view': true, 'intake.create': true, 'intake.manage': false } };
        state.blueBook = { enabled: true, permissions: { 'blueBook.view': true, 'blueBook.manage': false, 'blueBook.viewAmounts': false } };
        state.workLog = { enabled: true, permissions: { 'workLog.view': true, 'workLog.submit': true, 'workLog.verify': false } };
    }
    return state;
}

export function parsePermissions(json: string | undefined, role: string): PermissionsState {
    if (!json) return getDefaultPermissions(role);
    try { return JSON.parse(json); }
    catch { return getDefaultPermissions(role); }
}

// ── Component ────────────────────────────────────────────────────────
export function PermissionsEditor({
    value,
    onChange,
    role,
}: {
    value: PermissionsState;
    onChange: (state: PermissionsState) => void;
    role: string;
}) {
    const { i18n } = useTranslation();
    const isEs = i18n.language?.startsWith('es');
    const [activeSection, setActiveSection] = useState<string>(PERMISSION_SECTIONS[0].id);

    const toggleSection = useCallback((sectionId: string) => {
        const next = { ...value };
        const section = next[sectionId];
        const newEnabled = !section?.enabled;
        next[sectionId] = {
            enabled: newEnabled,
            permissions: Object.fromEntries(
                PERMISSION_SECTIONS.find(s => s.id === sectionId)!.permissions.map(p => [p.key, newEnabled])
            ),
        };
        onChange(next);
    }, [value, onChange]);

    const togglePermission = useCallback((sectionId: string, permKey: string) => {
        const next = { ...value };
        const section = { ...next[sectionId] };
        section.permissions = { ...section.permissions, [permKey]: !section.permissions[permKey] };
        // If any permission is enabled, keep section enabled
        const anyEnabled = Object.values(section.permissions).some(Boolean);
        section.enabled = anyEnabled;
        next[sectionId] = section;
        onChange(next);
    }, [value, onChange]);

    const currentSection = useMemo(
        () => PERMISSION_SECTIONS.find(s => s.id === activeSection),
        [activeSection]
    );

    return (
        <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden min-h-[320px]">
            {/* Sidebar */}
            <div className="w-48 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/50 overflow-y-auto">
                <div className="px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    {isEs ? 'Roles y Permisos' : 'Roles & Permissions'}
                </div>
                {PERMISSION_SECTIONS.map((section) => (
                    <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                            activeSection === section.id
                                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/50'
                        }`}
                    >
                        <span className="text-sm">{section.icon}</span>
                        <span className="truncate">{isEs ? section.labelEs : section.labelEn}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-4">
                {currentSection && (
                    <div>
                        {/* Section toggle */}
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => toggleSection(currentSection.id)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${
                                    value[currentSection.id]?.enabled
                                        ? 'bg-blue-600'
                                        : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                                    value[currentSection.id]?.enabled ? 'translate-x-5' : ''
                                }`} />
                            </button>
                            <span className="text-sm">{currentSection.icon}</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                                {isEs ? currentSection.labelEs : currentSection.labelEn}
                            </span>
                        </div>

                        {/* Individual permissions */}
                        <div className="space-y-2">
                            {currentSection.permissions.map((perm) => {
                                const isChecked = value[currentSection.id]?.permissions[perm.key] ?? false;
                                return (
                                    <label
                                        key={perm.key}
                                        className="flex items-center gap-3 cursor-pointer py-1 pl-2"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => togglePermission(currentSection.id, perm.key)}
                                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">
                                            {isEs ? perm.labelEs : perm.labelEn}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
