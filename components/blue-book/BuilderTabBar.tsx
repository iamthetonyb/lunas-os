'use client';

import type { Builder } from '@/types/blue-book';

type Props = {
    builders: Builder[];
    activeBuilder: string | null;
    onBuilderChange: (builderId: string | null) => void;
};

export function BuilderTabBar({ builders, activeBuilder, onBuilderChange }: Props) {
    return (
        <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
                type="button"
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    activeBuilder === null
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                }`}
                onClick={() => onBuilderChange(null)}
            >
                All Builders
            </button>
            {builders.map((builder) => (
                <button
                    key={builder._id}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                        activeBuilder === builder._id
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                    }`}
                    onClick={() => onBuilderChange(builder._id)}
                >
                    {builder.name}
                </button>
            ))}
        </div>
    );
}
