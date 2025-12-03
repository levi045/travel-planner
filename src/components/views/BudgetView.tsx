import React, { useState } from 'react';
import { Banknote, ArrowRightLeft, Calculator } from 'lucide-react';
import { JPY_TO_TWD_RATE } from '../../constants';

export const BudgetView: React.FC = () => {
    const [jpy, setJpy] = useState("");
    const [twd, setTwd] = useState<number | null>(null);

    const handleCalculate = () => {
        const val = parseFloat(jpy);
        if (!isNaN(val)) {
            setTwd(Math.floor(val * JPY_TO_TWD_RATE));
        } else {
            setTwd(null);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 font-sans bg-gray-50">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <div className="flex items-center justify-center gap-2 text-teal-600 mb-6">
                    <Banknote size={24} />
                    <h2 className="text-xl font-bold">旅遊匯率換算</h2>
                </div>
                <div className="mb-6">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">日幣 (JPY)</label>
                    <div className="relative">
                        <input
                            type="number"
                            className="w-full text-3xl font-bold text-gray-800 border-b-2 border-gray-200 focus:border-teal-500 outline-none py-2 bg-transparent transition-colors placeholder-gray-200"
                            placeholder="0"
                            value={jpy}
                            onChange={(e) => setJpy(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCalculate()}
                        />
                        <span className="absolute right-0 bottom-3 text-sm font-bold text-gray-400">¥</span>
                    </div>
                </div>
                <div className="flex justify-center mb-6">
                    <div className="bg-gray-100 p-2 rounded-full text-gray-400 rotate-90">
                        <ArrowRightLeft size={20} />
                    </div>
                </div>
                <div className="mb-8">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">
                        台幣 (TWD) <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded ml-2">匯率: {JPY_TO_TWD_RATE}</span>
                    </label>
                    <div className="text-4xl font-black text-teal-600 py-2 border-b-2 border-transparent">
                        {twd !== null ? `$${twd.toLocaleString()}` : '--'}
                    </div>
                </div>
                <button
                    onClick={handleCalculate}
                    className="w-full py-4 rounded-xl bg-teal-600 text-white font-bold text-lg hover:bg-teal-700 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Calculator size={20} /> 計算
                </button>
            </div>
            <p className="mt-8 text-xs text-gray-400 text-center">
                ✨ 弟弟的小提醒：匯率是用 {JPY_TO_TWD_RATE} 估算的喔！<br />實際還是要看刷卡當下的匯率～☕️
            </p>
        </div>
    );
};

