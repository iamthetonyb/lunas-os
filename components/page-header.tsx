'use client';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700/50 transition-colors duration-200">
      <div className="px-6 py-5 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}
