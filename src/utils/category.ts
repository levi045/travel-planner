export const getCategoryStyle = (category: string): string => {
    const styleMap: Record<string, string> = {
        '觀光景點': 'border-red-400 text-red-600 bg-red-50',
        '美食餐廳': 'border-orange-400 text-orange-600 bg-orange-50',
        '購物行程': 'border-yellow-400 text-yellow-600 bg-yellow-50',
        '咖啡廳': 'border-amber-400 text-amber-600 bg-amber-50',
        '神社/寺廟': 'border-stone-400 text-stone-600 bg-stone-50',
    };

    return styleMap[category] || 'border-gray-400 text-gray-600 bg-gray-50';
};

