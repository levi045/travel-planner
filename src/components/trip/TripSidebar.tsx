import React, { useState } from 'react';
import { FolderOpen, FilePlus, X, Settings, Lock, Save, Loader2 } from 'lucide-react';
import { useStore } from '../../store/useItineraryStore';
import { TripDetailModal } from './TripDetailModal';
import { cn } from '../../utils/cn';

interface TripSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TripSidebar: React.FC<TripSidebarProps> = ({ isOpen, onClose }) => {
    const {
        trips,
        activeTripId,
        createTrip,
        switchTrip,
        deleteTrip,
        updateTripInfo,
        updateTripDates,
        toggleTripLock,
        saveTripsToCloud,
        syncStatus
    } = useStore();
    const [editingTripId, setEditingTripId] = useState<string | null>(null);

    const handleCreate = () => {
        const newId = createTrip();
        setEditingTripId(newId);
    };

    return (
        <>
            <div className={cn(
                "fixed inset-y-0 left-0 z-[100] w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out",
                isOpen ? 'translate-x-0' : '-translate-x-full'
            )}>
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-teal-600 text-white">
                    <h2 className="font-bold flex items-center gap-2">
                        <FolderOpen size={20} /> 我的行程庫
                    </h2>
                    <button
                        onClick={saveTripsToCloud}
                        disabled={syncStatus === 'saving'}
                        className="p-1.5 bg-teal-700/50 hover:bg-teal-700 rounded text-teal-100 transition-colors flex items-center gap-1 text-xs"
                        title="手動儲存至雲端"
                    >
                        {syncStatus === 'saving' ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <Save size={14} />
                        )}
                    </button>
                    <button onClick={onClose} className="hover:bg-teal-700 p-1 rounded">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto h-full pb-20 flex flex-col gap-2">
                    {trips.map(trip => (
                        <div
                            key={trip.id}
                            onClick={() => {
                                switchTrip(trip.id);
                                onClose();
                            }}
                            className={cn(
                                "group p-3 rounded-lg cursor-pointer border transition-all",
                                activeTripId === trip.id
                                    ? 'bg-teal-50 border-teal-500 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-teal-300'
                            )}
                        >
                            <div className="flex justify-between items-start">
                                <h3 className={cn(
                                    "font-bold",
                                    activeTripId === trip.id ? 'text-teal-700' : 'text-gray-700'
                                )}>
                                    {trip.name}
                                    {trip.isLocked && <Lock size={12} className="inline ml-1 text-gray-400" />}
                                </h3>
                                <div className="flex gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            switchTrip(trip.id);
                                            setEditingTripId(trip.id);
                                        }}
                                        className="text-gray-400 hover:text-teal-500 transition-opacity p-1"
                                    >
                                        <Settings size={14} />
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {trip.destination} • {trip.days.length} 天
                            </p>
                        </div>
                    ))}
                    <button
                        onClick={handleCreate}
                        className="w-full py-3 mt-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg flex items-center justify-center gap-2 hover:border-teal-500 hover:text-teal-600 transition-colors font-medium"
                    >
                        <FilePlus size={18} /> 建立新行程
                    </button>
                </div>
            </div>

            <TripDetailModal
                trip={trips.find(t => t.id === editingTripId)}
                isOpen={!!editingTripId}
                onClose={() => setEditingTripId(null)}
                onUpdate={(info) => updateTripInfo(info)}
                onUpdateDates={(start: string, end: string) => updateTripDates(start, end)}
                onDelete={deleteTrip}
                toggleLock={toggleTripLock}
            />
        </>
    );
};

