import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Settings2, X, Lock, LocateFixed, Clock, Tag, StickyNote, AlertCircle, Trash2, Plus } from 'lucide-react';
import type { Spot } from '../../types';
import { DEFAULT_CATEGORIES } from '../../constants';
import { getCategoryStyle } from '../../utils/category';
import { MagicTimeInput } from '../common/MagicTimeInput';
import { cn } from '../../utils/cn';

interface SpotDetailModalProps {
    spot: Spot;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (id: string, info: Partial<Spot>) => void;
    onRemove: (id: string) => void;
    savedCategories: string[];
    addCategory: (category: string) => void;
    removeCategory: (category: string) => void;
    setPickingLocation: (spotId: string) => void;
    isLocked: boolean;
}

export const SpotDetailModal: React.FC<SpotDetailModalProps> = ({
    spot,
    isOpen,
    onClose,
    onUpdate,
    onRemove,
    savedCategories,
    addCategory,
    removeCategory,
    setPickingLocation,
    isLocked
}) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 font-sans">
                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <Settings2 size={18} className="text-teal-600" /> 景點詳細設定
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto">
                    {isLocked && (
                        <div className="mb-4 p-2 bg-red-50 text-red-500 text-xs rounded border border-red-100 flex items-center gap-2">
                            <Lock size={12} /> 唯讀模式
                        </div>
                    )}
                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">景點名稱</label>
                        <input
                            disabled={isLocked}
                            className={cn(
                                "w-full text-lg font-bold text-gray-800 border-b-2 border-gray-200 focus:border-teal-500 outline-none py-1 bg-transparent transition-colors",
                                isLocked && "cursor-not-allowed text-gray-500"
                            )}
                            value={spot.name}
                            onChange={(e) => onUpdate(spot.id, { name: e.target.value })}
                        />
                    </div>

                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">位置設定</label>
                        <div className="flex gap-2">
                            <button
                                disabled={isLocked}
                                onClick={() => {
                                    onClose();
                                    setPickingLocation(spot.id);
                                }}
                                className={cn(
                                    "flex-1 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-teal-100 transition-all",
                                    isLocked && "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                )}
                            >
                                <LocateFixed size={16} /> 點選地圖設定位置
                            </button>
                            {spot.location.lat !== 0 && (
                                <div className="text-xs text-gray-400 flex items-center px-2">已設定</div>
                            )}
                        </div>
                    </div>

                    <div className="mb-5">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                            <Clock size={12} />時間
                        </label>
                        <MagicTimeInput
                            disabled={isLocked}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold text-gray-700 focus:border-teal-400 outline-none"
                            value={spot.startTime || ''}
                            onChange={(val: string) => onUpdate(spot.id, { startTime: val })}
                            placeholder="輸入時間 (例: 19 -> 19:00)"
                        />
                    </div>

                    <div className="mb-5">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                            <Tag size={12} /> 景點類型
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                            {savedCategories.map((cat: string) => {
                                const isDefault = (DEFAULT_CATEGORIES as readonly string[]).includes(cat);
                                const isConfirming = confirmDeleteCat === cat;

                                return (
                                    <div key={cat} className="relative group/cat">
                                        <button
                                            disabled={isLocked}
                                            onClick={() => onUpdate(spot.id, { category: cat })}
                                            className={cn(
                                                "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                                                spot.category === cat && cn(getCategoryStyle(cat), "ring-2 ring-offset-1 ring-teal-200"),
                                                spot.category !== cat && "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
                                                isLocked && "cursor-not-allowed opacity-70"
                                            )}
                                        >
                                            {cat}
                                        </button>

                                        {!isDefault && !isLocked && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isConfirming) {
                                                        removeCategory(cat);
                                                        setConfirmDeleteCat(null);
                                                    } else {
                                                        setConfirmDeleteCat(cat);
                                                        setTimeout(() => setConfirmDeleteCat(null), 3000);
                                                    }
                                                }}
                                                className={cn(
                                                    "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] border transition-all z-10",
                                                    isConfirming
                                                        ? 'bg-red-500 text-white border-red-600 scale-110'
                                                        : 'bg-gray-100 text-gray-400 border-gray-200 opacity-0 group-hover/cat:opacity-100 hover:bg-red-100 hover:text-red-500'
                                                )}
                                                title={isConfirming ? "再點一次刪除" : "刪除分類"}
                                            >
                                                {isConfirming ? '!' : 'x'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            {!isLocked && (
                                <div className="flex items-center gap-1 px-2 rounded-full border border-dashed border-gray-300 focus-within:border-teal-400 bg-gray-50/50">
                                    <Plus size={12} className="text-gray-400" />
                                    <input
                                        className="bg-transparent text-xs w-20 py-1.5 outline-none placeholder-gray-400"
                                        placeholder="新增分類..."
                                        value={newCatName}
                                        onChange={(e) => setNewCatName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newCatName) {
                                                addCategory(newCatName);
                                                onUpdate(spot.id, { category: newCatName });
                                                setNewCatName("");
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                            <StickyNote size={12} /> 備註 & 筆記
                        </label>
                        <textarea
                            disabled={isLocked}
                            className={cn(
                                "w-full text-sm text-gray-600 border border-gray-200 rounded-lg p-3 outline-none focus:border-teal-300 min-h-[80px] bg-gray-50 focus:bg-white transition-colors resize-none",
                                isLocked && "bg-gray-100 cursor-not-allowed"
                            )}
                            placeholder="寫點什麼..."
                            value={spot.note || ''}
                            onChange={(e) => onUpdate(spot.id, { note: e.target.value })}
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-3">
                    {!isLocked && (
                        <div className="flex-1 flex gap-2">
                            {confirmDelete ? (
                                <>
                                    <button
                                        onClick={() => {
                                            onRemove(spot.id);
                                            onClose();
                                        }}
                                        className="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all flex justify-center items-center gap-2"
                                    >
                                        <AlertCircle size={16} /> 確定刪除
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        className="px-4 py-2 rounded-lg text-sm font-bold bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all"
                                    >
                                        取消
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all bg-white text-red-500 border border-red-200 hover:bg-red-50"
                                >
                                    <Trash2 size={16} /> 刪除景點
                                </button>
                            )}
                        </div>
                    )}

                    {!confirmDelete && (
                        <button
                            onClick={onClose}
                            className="ml-auto px-6 py-2 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 shadow-sm active:scale-95 transition-all"
                        >
                            完成
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

