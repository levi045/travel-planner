import React from 'react';
import { Camera, ExternalLink } from 'lucide-react';

export const TranslateView: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 font-sans">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Google 翻譯捷徑</h2>
            <p className="text-gray-400 mb-8">請選擇您需要的翻譯模式</p>

            <div className="w-full max-w-sm flex flex-col gap-4">
                <a
                    href="https://translate.google.com/?op=images"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
                >
                    <div className="flex flex-col items-start">
                        <span className="text-xs opacity-80 mb-1">菜單 / 看板</span>
                        <span className="text-2xl font-bold">照相翻譯 📸</span>
                    </div>
                    <Camera size={28} />
                </a>
                <a
                    href="https://translate.google.com/?sl=zh-TW&tl=ja&op=translate"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
                >
                    <div className="flex flex-col items-start">
                        <span className="text-xs opacity-80 mb-1">我說中文 (轉日文)</span>
                        <span className="text-2xl font-bold">CH → JA</span>
                    </div>
                    <ExternalLink size={24} />
                </a>
                <a
                    href="https://translate.google.com/?sl=ja&tl=zh-TW&op=translate"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-6 rounded-2xl bg-white text-gray-800 border-2 border-gray-100 shadow-sm hover:border-gray-300 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer"
                >
                    <div className="flex flex-col items-start">
                        <span className="text-xs text-gray-400 mb-1">對方說日文 (轉中文)</span>
                        <span className="text-2xl font-bold text-gray-700">JA → CH</span>
                    </div>
                    <ExternalLink size={24} className="text-gray-300" />
                </a>
            </div>
        </div>
    );
};

