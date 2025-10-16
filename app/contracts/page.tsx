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
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            📄 Contract Settings
          </div>
        }
      />
      <main className="px-6 py-6">
        <Tab.Group>
          <Tab.List className="flex space-x-2 bg-white dark:bg-slate-800 rounded-lg p-1.5 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  classNames(
                    'flex-1 rounded-lg py-3 px-4 text-sm font-medium leading-5 transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800',
                    selected
                      ? 'bg-blue-600 dark:bg-blue-700 text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )
                }
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.name}</span>
                </div>
              </Tab>
            ))}
          </Tab.List>
          
          <Tab.Panels>
            {tabs.map((tab, idx) => (
              <Tab.Panel
                key={idx}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200"
              >
                {/* Tab Header */}
                <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{tab.icon}</span>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {tab.name} Management
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 ml-12">
                    {tab.description}
                  </p>
                </div>

                {/* Tab Content */}
                <div className="space-y-4">
                  <tab.component />
                </div>

                {/* Quick Tips */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 text-sm mb-2">
                    💡 Quick Tips
                  </h4>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                    {tab.name === 'Services' && (
                      <>
                        <li>Services define what work types you offer to builders</li>
                        <li>Each service can have different unit types (per job, per sqft, etc.)</li>
                        <li>Inactive services will not appear in job intake forms</li>
                      </>
                    )}
                    {tab.name === 'Model Plans' && (
                      <>
                        <li>Model plans store default values for each builder&apos;s house types</li>
                        <li>Set default window and tub counts to speed up data entry</li>
                        <li>Square footage helps with per-sqft pricing calculations</li>
                      </>
                    )}
                    {tab.name === 'Rates' && (
                      <>
                        <li>Rates can be set at builder, community, or model plan level</li>
                        <li>More specific rates (model plan) override general rates (builder)</li>
                        <li>Review rates regularly to ensure profitability</li>
                      </>
                    )}
                  </ul>
                </div>
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      </main>
    </AppLayout>
  );
}
