export interface FormattedDate {
    month: string;
    date: string;
    day: string;
    full: string;
    iso: string;
}

export const formatDate = (startDateStr: string, dayOffset: number): FormattedDate => {
    if (!startDateStr) {
        return { month: '??', date: '??', day: '??', full: '未定', iso: '' };
    }

    const date = new Date(startDateStr);
    if (isNaN(date.getTime())) {
        return { month: '??', date: '??', day: '??', full: '未定', iso: '' };
    }

    date.setDate(date.getDate() + dayOffset);

    return {
        month: (date.getMonth() + 1).toString(),
        date: date.getDate().toString().padStart(2, '0'),
        day: date.toLocaleDateString('zh-TW', { weekday: 'short' }),
        full: date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }),
        iso: date.toISOString().split('T')[0]
    };
};

