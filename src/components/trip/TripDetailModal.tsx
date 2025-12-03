import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, Lock, Unlock, X, Trash2, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import type { Trip } from '../../types';
import { cn } from '../../utils/cn';

interface TripDetailModalProps {
    trip: Trip | undefined;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (info: Partial<Trip>) => void;
    onUpdateDates: (startDate: string, endDate: string) => void;
    onDelete: (id: string) => void;
    toggleLock: (id: string) => void;
}

export const TripDetailModal: React.FC<TripDetailModalProps> = ({
    trip,
    isOpen,
    onClose,
    onUpdate,
    onUpdateDates,
    onDelete,
    toggleLock
}) => {
    const [tempName, setTempName] = useState(trip?.name || '');
    const [tempDestination, setTempDestination] = useState(trip?.destination || '');
    const [tempStartDate, setTempStartDate] = useState(trip?.startDate || '');
    const [tempEndDate, setTempEndDate] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (!trip) return;
        setTempName(trip.name);
        setTempDestination(trip.destination);
        setTempStartDate(trip.startDate);
        setConfirmDelete(false);

        const start = new Date(trip.startDate);
        if (!isNaN(start.getTime())) {
            const end = new Date(start);
            end.setDate(start.getDate() + Math.max(0, trip.days.length - 1));
            setTempEndDate(end.toISOString().split('T')[0]);
        }
    }, [trip, isOpen]);

    if (!isOpen || !trip) return null;

    const handleSave = () => {
        if (trip.isLocked) return;

        onUpdate({ name: tempName, destination: tempDestination });

        const start = new Date(tempStartDate);
        const end = new Date(tempEndDate);

        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            if (end < start) {
                alert("結束日期不能早於出發日期喔！🙅‍♂️");
                return;
            }

            const diffTime = Math.abs(end.getTime() - start.getTime());
            const newDaysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            const oldDaysCount = trip.days.length;

            if (newDaysCount < oldDaysCount) {
                const removeCount = oldDaysCount - newDaysCount;
                const confirmed = window.confirm(
                    `⚠️ 注意：您縮短了行程日期！\n\n這將會刪除最後 ${removeCount} 天的所有行程內容。\n\n確定要繼續嗎？`
                );
                if (!confirmed) return;
            }

            onUpdateDates(tempStartDate, tempEndDate);
        }

        onClose();
    };

    const handleDelete = () => {
        if (window.confirm(`⚠️ 嚴重警告：您確定要永久刪除「${trip.name}」嗎？\n此動作無法復原！`)) {
            onDelete(trip.id);
            onClose();
        }
    };

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 font-sans">
                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-teal-50/50">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <Settings2 size={18} className="text-teal-600" /> 行程設定
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => toggleLock(trip.id)}
                            className={cn(
                                "p-1.5 rounded-full transition-all flex items-center gap-1 px-3 text-xs font-bold border",
                                trip.isLocked
                                    ? 'bg-red-50 text-red-500 border-red-200'
                                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-teal-50 hover:text-teal-600'
                            )}
                        >
                            {trip.isLocked ? (
                                <>
                                    <Lock size={14} /> 已鎖定 (唯讀)
                                </>
                            ) : (
                                <>
                                    <Unlock size={14} /> 未鎖定
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {trip.isLocked && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs flex items-center gap-2">
                            <Lock size={16} /> 此行程已鎖定保護，無法編輯內容。如需修改請先解鎖。
                        </div>
                    )}

                    <div className="mb-5">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">行程名稱</label>
                        <input
                            disabled={trip.isLocked}
                            className={cn(
                                "w-full text-lg font-bold text-gray-800 border-b-2 border-gray-200 focus:border-teal-500 outline-none py-1 bg-transparent transition-colors",
                                trip.isLocked && "cursor-not-allowed text-gray-500"
                            )}
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            placeholder="輸入行程名稱..."
                        />
                    </div>

                    <div className="mb-5">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-1">
                            <MapPin size={12} /> 旅行地點
                        </label>
                        <input
                            disabled={trip.isLocked}
                            className={cn(
                                "w-full text-base text-gray-700 border border-gray-200 rounded-lg p-3 outline-none focus:border-teal-300 bg-gray-50 focus:bg-white transition-colors",
                                trip.isLocked && "bg-gray-100 cursor-not-allowed"
                            )}
                            value={tempDestination}
                            onChange={(e) => setTempDestination(e.target.value)}
                            placeholder="例如：日本東京、京都..."
                        />
                    </div>

                    <div className="flex gap-3 mb-2">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-1">
                                <CalendarIcon size={12} /> 出發日期
                            </label>
                            <input
                                disabled={trip.isLocked}
                                type="date"
                                className={cn(
                                    "w-full text-sm font-bold text-gray-700 border border-gray-200 rounded-lg p-3 outline-none focus:border-teal-300 bg-gray-50 focus:bg-white transition-colors",
                                    trip.isLocked && "bg-gray-100 cursor-not-allowed"
                                )}
                                value={tempStartDate}
                                onChange={(e) => setTempStartDate(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block flex items-center gap-1">
                                <CalendarIcon size={12} /> 回程日期
                            </label>
                            <input
                                disabled={trip.isLocked}
                                type="date"
                                className={cn(
                                    "w-full text-sm font-bold text-gray-700 border border-gray-200 rounded-lg p-3 outline-none focus:border-teal-300 bg-gray-50 focus:bg-white transition-colors",
                                    trip.isLocked && "bg-gray-100 cursor-not-allowed"
                                )}
                                value={tempEndDate}
                                onChange={(e) => setTempEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 ml-1">✨ 修改日期後，系統會自動幫您增減天數喔！</p>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    {!trip.isLocked && (
                        <button
                            onClick={() => setConfirmDelete(true)}
                            className="text-red-400 text-xs font-bold hover:text-red-600 flex items-center gap-1 px-2 py-1 hover:bg-red-50 rounded"
                        >
                            <Trash2 size={14} /> 刪除此行程
                        </button>
                    )}

                    {confirmDelete ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-red-500 font-bold">確定要刪除嗎?</span>
                            <button
                                onClick={handleDelete}
                                className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-md hover:bg-red-600"
                            >
                                是
                            </button>
                            <button
                                onClick={() => setConfirmDelete(false)}
                                className="bg-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-md hover:bg-gray-300"
                            >
                                否
                            </button>
                        </div>
                    ) : (
                        <div className="ml-auto">
                            <button
                                onClick={handleSave}
                                disabled={trip.isLocked}
                                className={cn(
                                    "px-6 py-2 rounded-lg font-bold text-sm shadow-sm transition-all",
                                    trip.isLocked
                                        ? 'bg-gray-300 text-white cursor-not-allowed'
                                        : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95'
                                )}
                            >
                                {trip.isLocked ? '鎖定中' : '完成設定'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

