'use client';

import { AppLayout } from '@/components/app-layout';
import { PageHeader } from '@/components/page-header';
import { Tab } from '@headlessui/react';
import { ServicesCrud } from '@/components/services-crud';
import { ModelPlansCrud } from '@/components/model-plans-crud';
import { RatesCrud } from '@/components/rates-crud';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ContractsPage() {
  const tabs = [
    { 
      name: 'Services', 
      icon: '🛠️', 
      description: 'Define and manage service types offered to builders',
      component: ServicesCrud 
    },
    { 
      name: 'Model Plans', 
      icon: '🏠', 
      description: 'Configure house models with default settings for each builder',
      component: ModelPlansCrud 
    },
    { 
      name: 'Rates', 
      icon: '💵', 
      description: 'Set pricing for services by builder, community, or model plan',
      component: RatesCrud 
    },
  ];

  return (
    <AppLayout>
      <PageHeader 
        title="Contracts & Configuration" 
        description="Manage services, model plans, and pricing rates"
        action={
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="text-blue-600 dark:text-blue-400">📄</span>
            <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">Contract Settings</span>
          </div>
        }
      />
      <main className="px-6 py-6">
        <Tab.Group>
          <Tab.List className="flex space-x-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-2 shadow-md border border-gray-200 dark:border-gray-700 mb-6">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  classNames(
                    'flex-1 rounded-lg py-3.5 px-5 text-sm font-semibold leading-5 transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    selected
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-600 dark:to-blue-800 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm'
                  )
                }
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">{tab.icon}</span>
                  <span>{tab.name}</span>
                </div>
              </Tab>
            ))}
          </Tab.List>
          
          <Tab.Panels>
            {tabs.map((tab, idx) => (
              <Tab.Panel
                key={idx}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200"
              >
                {/* Tab Header */}
                <div className="mb-6 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2 shadow-md">
                      <span className="text-3xl">{tab.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {tab.name} Management
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {tab.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="space-y-4">
                  <tab.component />
                </div>

                {/* Quick Tips */}
                <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-l-4 border-blue-500 dark:border-blue-400 rounded-r-lg shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-500 dark:bg-blue-600 rounded-full p-1.5 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-blue-900 dark:text-blue-300 text-sm mb-2">
                        Quick Tips
                      </h4>
                      <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1.5 ml-1">
                        {tab.name === 'Services' && (
                          <>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>Services define what work types you offer to builders</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>Each service can have different unit types (per job, per sqft, etc.)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>Inactive services will not appear in job intake forms</span>
                            </li>
                          </>
                        )}
                        {tab.name === 'Model Plans' && (
                          <>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>Model plans store default values for each builder&apos;s house types</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>Set default window and tub counts to speed up data entry</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>Square footage helps with per-sqft pricing calculations</span>
                            </li>
                          </>
                        )}
                        {tab.name === 'Rates' && (
                          <>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>Rates can be set at builder, community, or model plan level</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>More specific rates (model plan) override general rates (builder)</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>Review rates regularly to ensure profitability</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      </main>
    </AppLayout>
  );
}
