'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
};

export function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
}: Props) {
    const confirmClasses =
        variant === 'danger'
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white';

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30" />
                </Transition.Child>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="scale-95 opacity-0"
                            enterTo="scale-100 opacity-100"
                            leave="ease-in duration-150"
                            leaveFrom="scale-100 opacity-100"
                            leaveTo="scale-95 opacity-0"
                        >
                            <Dialog.Panel className="w-full max-w-sm rounded-lg bg-white dark:bg-slate-800 p-6 shadow-2xl">
                                <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {title}
                                </Dialog.Title>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                    {message}
                                </p>
                                <div className="flex justify-end gap-2 mt-6">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm"
                                    >
                                        {cancelLabel}
                                    </button>
                                    <button
                                        onClick={() => {
                                            onConfirm();
                                            onClose();
                                        }}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${confirmClasses}`}
                                    >
                                        {confirmLabel}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
