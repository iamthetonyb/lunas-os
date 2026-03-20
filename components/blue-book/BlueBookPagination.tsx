'use client';

import { Pagination } from '@/components/ui/pagination';
import { useTranslation } from 'react-i18next';

type Props = {
    page: number;
    totalPages: number;
    total: number;
    onPageChange: (page: number) => void;
};

export function BlueBookPagination({ page, totalPages, total, onPageChange }: Props) {
    const { t } = useTranslation();

    return (
        <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={500}
            onPageChange={onPageChange}
            noun={t('blueBook.entries', 'entries')}
        />
    );
}
