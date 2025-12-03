import React from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { SensorDescriptor, SensorOptions, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { Day } from '../../types';
import { formatDate } from '../../utils/date';
import { DayTab } from './DayTab';
import { cn } from '../../utils/cn';

interface DayTabsProps {
    days: Day[];
    currentDayIndex: number;
    startDate: string;
    onDayClick: (index: number) => void;
    onDayDelete: (index: number) => void;
    onDayDragEnd: (event: DragEndEvent) => void;
    onAddDay: () => void;
    isLocked: boolean;
    sensors: SensorDescriptor<SensorOptions>[];
}

export const DayTabs: React.FC<DayTabsProps> = ({
    days,
    currentDayIndex,
    startDate,
    onDayClick,
    onDayDelete,
    onDayDragEnd,
    onAddDay,
    isLocked,
    sensors
}) => {
    const handleDragEnd = (event: DragEndEvent) => {
        onDayDragEnd(event);
    };

    return (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={days.map(d => d.id)} strategy={horizontalListSortingStrategy}>
                    {days.map((day, index) => (
                        <DayTab
                            key={day.id}
                            day={day}
                            index={index}
                            isActive={currentDayIndex === index}
                            onClick={() => onDayClick(index)}
                            displayDate={`${formatDate(startDate, index).date}/${formatDate(startDate, index).day}`}
                            showDelete={days.length > 1}
                            onDelete={() => onDayDelete(index)}
                            isLocked={isLocked}
                        />
                    ))}
                </SortableContext>
            </DndContext>
            {!isLocked && (
                <button
                    onClick={onAddDay}
                    className={cn(
                        "w-[60px] h-[60px] rounded-xl flex flex-col items-center justify-center bg-teal-800/30 text-teal-200 border-2 border-dashed border-teal-500/50 hover:bg-teal-600 hover:text-white transition-all shrink-0"
                    )}
                >
                    <Plus size={20} />
                </button>
            )}
        </div>
    );
};

