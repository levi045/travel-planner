import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import type { Day } from '../../types';
import { cn } from '../../utils/cn';

interface DayTabProps {
    day: Day;
    index: number;
    isActive: boolean;
    onClick: () => void;
    displayDate: string;
    onDelete: () => void;
    showDelete: boolean;
    isLocked: boolean;
}

export const DayTab: React.FC<DayTabProps> = React.memo(({
    day,
    index,
    isActive,
    onClick,
    displayDate,
    onDelete,
    showDelete,
    isLocked
}) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: day.id,
        disabled: isLocked
    });
    const style = { transform: CSS.Translate.toString(transform), transition };
    const [isConfirming, setIsConfirming] = useState(false);

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group flex-shrink-0 touch-none">
            <button
                onClick={onClick}
                className={cn(
                    "w-[60px] h-[60px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer select-none border-2 relative overflow-hidden",
                    isActive
                        ? 'bg-white border-white text-teal-700 shadow-md transform scale-105 z-10'
                        : 'bg-teal-800/40 border-transparent text-teal-100 hover:bg-teal-700',
                    isLocked ? 'cursor-default' : 'cursor-grab'
                )}
            >
                <span className="text-[10px] font-medium opacity-80 uppercase">{displayDate}</span>
                <span className="text-lg font-bold">D{index + 1}</span>
            </button>

            {showDelete && !isLocked && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isConfirming) {
                            onDelete();
                            setIsConfirming(false);
                        } else {
                            setIsConfirming(true);
                            setTimeout(() => setIsConfirming(false), 3000);
                        }
                    }}
                    className={cn(
                        "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm border border-white transition-all z-20",
                        isConfirming
                            ? 'bg-red-600 text-white scale-110'
                            : 'bg-gray-200 text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white'
                    )}
                    title={isConfirming ? "再點一次刪除" : "刪除這一天"}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {isConfirming ? '!' : <X size={12} />}
                </button>
            )}
        </div>
    );
});

DayTab.displayName = 'DayTab';

