import React, { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapIcon, MapPin, Trash2, LocateFixed, AlertCircle, Lock } from 'lucide-react';
import type { Spot } from '../../types';
import { getCategoryStyle } from '../../utils/category';
import { cn } from '../../utils/cn';
import { SpotDetailModal } from './SpotDetailModal';

interface SpotCardProps {
    spot: Spot;
    index: number;
    updateSpot: (id: string, info: Partial<Spot>) => void;
    removeSpot: (spotId: string) => void;
    savedCategories: string[];
    addCategory: (category: string) => void;
    removeCategory: (category: string) => void;
    setPickingLocation: (spotId: string) => void;
    onAutoLocate: (spotId: string, name: string) => Promise<void>;
    isLocked: boolean;
}

export const SpotCard: React.FC<SpotCardProps> = React.memo(({
    spot,
    updateSpot,
    removeSpot,
    savedCategories,
    addCategory,
    removeCategory,
    setPickingLocation,
    isLocked
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: spot.id,
        disabled: isLocked
    });
    const [isModalOpen, setModalOpen] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 1,
        position: 'relative' as const
    };

    const categoryStyle = getCategoryStyle(spot.category || 'other');
    const hasLocation = spot.location.lat !== 0 && spot.location.lng !== 0;

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isConfirmingDelete) {
            removeSpot(spot.id);
        } else {
            setIsConfirmingDelete(true);
            setTimeout(() => setIsConfirmingDelete(false), 3000);
        }
    }, [isConfirmingDelete, removeSpot, spot.id]);

    return (
        <>
            <div ref={setNodeRef} style={style} className="relative mb-3 group touch-none">
                <div className={cn(
                    "bg-white rounded-xl shadow-sm border border-gray-100 transition-all flex items-stretch p-0 overflow-hidden h-[76px]",
                    !isLocked && "hover:border-teal-200"
                )}>
                    <div
                        {...attributes}
                        {...listeners}
                        className={cn(
                            "w-[70px] bg-gray-50 border-r border-gray-100 flex flex-col justify-center items-center shrink-0 transition-colors",
                            isLocked ? "cursor-not-allowed opacity-60" : "cursor-grab hover:bg-gray-100"
                        )}
                    >
                        <div className="text-[10px] text-gray-400 font-bold mb-0.5 uppercase">時間</div>
                        <div className="text-sm font-black text-gray-700 tracking-tight">
                            {spot.startTime || '--:--'}
                        </div>
                    </div>

                    <div
                        className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2 gap-1 cursor-pointer hover:bg-gray-50/50 transition-colors"
                        onClick={() => setModalOpen(true)}
                    >
                        <input
                            disabled={isLocked}
                            className={cn(
                                "font-bold text-gray-800 text-sm truncate bg-transparent outline-none border-b border-transparent focus:border-teal-300 w-full placeholder-gray-400",
                                isLocked && "cursor-pointer"
                            )}
                            value={spot.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateSpot(spot.id, { name: e.target.value })}
                            placeholder="輸入景點名稱..."
                        />

                        <div className="flex items-center gap-2">
                            {hasLocation ? (
                                <div className="text-xs text-gray-400 flex items-center gap-1 truncate max-w-[150px]">
                                    <MapPin size={10} className="text-teal-500" /> {spot.address || '地圖點位'}
                                </div>
                            ) : (
                                <div className="text-xs text-orange-400 flex items-center gap-1">
                                    <AlertCircle size={10} /> 點此設定地點
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <div className={cn("text-[9px] px-1.5 py-0 rounded-md border flex items-center gap-1 inline-block", categoryStyle)}>
                                {spot.category}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col justify-center items-center px-2 border-l border-gray-50 gap-2 w-[40px]">
                        {hasLocation ? (
                            <a
                                href={`https://www.google.com/maps/search/?api=1&query=${spot.location.lat},${spot.location.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-gray-400 hover:text-teal-600 transition-colors"
                                title="Google Map"
                            >
                                <MapIcon size={18} />
                            </a>
                        ) : (
                            !isLocked && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPickingLocation(spot.id);
                                    }}
                                    className="text-orange-300 hover:text-orange-500"
                                    title="設定位置"
                                >
                                    <LocateFixed size={18} />
                                </button>
                            )
                        )}

                        {!isLocked && (
                            <button
                                onClick={handleDelete}
                                className={cn(
                                    "transition-all",
                                    isConfirmingDelete
                                        ? "text-red-500 bg-red-100 rounded-full p-1"
                                        : "text-gray-300 hover:text-red-400 group-hover:opacity-100 md:opacity-0"
                                )}
                                title={isConfirmingDelete ? "再次點擊以刪除" : "刪除"}
                            >
                                {isConfirmingDelete ? (
                                    <Trash2 size={14} className="animate-bounce" />
                                ) : (
                                    <Trash2 size={16} />
                                )}
                            </button>
                        )}
                        {isLocked && <Lock size={14} className="text-gray-200" />}
                    </div>
                </div>
            </div>

            <SpotDetailModal
                spot={spot}
                isOpen={isModalOpen}
                onClose={() => setModalOpen(false)}
                onUpdate={updateSpot}
                onRemove={removeSpot}
                savedCategories={savedCategories}
                addCategory={addCategory}
                removeCategory={removeCategory}
                setPickingLocation={setPickingLocation}
                isLocked={isLocked}
            />
        </>
    );
});

SpotCard.displayName = 'SpotCard';

