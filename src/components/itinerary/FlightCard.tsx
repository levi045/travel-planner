import React, { useState } from 'react';
import { PlaneTakeoff, PlaneLanding, Wand2 } from 'lucide-react';
import type { FlightInfo } from '../../types';
import { SmartTimeInput } from '../common/SmartTimeInput';
import { fetchFlightData } from '../../utils/flight';
import { cn } from '../../utils/cn';

interface FlightCardProps {
    type: 'outbound' | 'inbound';
    flight: FlightInfo;
    onUpdate: (info: Partial<FlightInfo>) => void;
    isLocked: boolean;
}

export const FlightCard: React.FC<FlightCardProps> = React.memo(({
    type,
    flight,
    onUpdate,
    isLocked
}) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleAutoImport = async () => {
        if (!flight.flightNo || isLocked) return;
        setIsLoading(true);
        const data = await fetchFlightData(flight.flightNo);
        setIsLoading(false);
        if (data) onUpdate(data);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAutoImport();
        }
    };

    return (
        <div className={cn(
            "mb-3 relative rounded-xl border-2 border-dashed p-3 shadow-sm transition-all bg-white group",
            !isLocked && "hover:border-teal-200"
        )}>
            <div className="flex items-center gap-3">
                <div className={cn(
                    "p-2 rounded-full text-white shrink-0",
                    type === 'outbound' ? 'bg-blue-400' : 'bg-orange-400'
                )}>
                    {type === 'outbound' ? <PlaneTakeoff size={18} /> : <PlaneLanding size={18} />}
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                        <input
                            disabled={isLocked}
                            className={cn(
                                "w-full bg-transparent text-sm font-bold text-gray-700 outline-none uppercase placeholder-gray-300",
                                isLocked && "cursor-not-allowed text-gray-400"
                            )}
                            placeholder="航班號"
                            value={flight.flightNo}
                            onChange={(e) => onUpdate({ flightNo: e.target.value })}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <div className="col-span-9 flex items-center justify-between text-gray-500">
                        <div className="flex flex-col items-center">
                            <SmartTimeInput
                                disabled={isLocked}
                                className="bg-transparent text-base font-bold text-gray-800 outline-none w-12 text-center"
                                value={flight.depTime}
                                onChange={(val: string) => onUpdate({ depTime: val })}
                                placeholder="--:--"
                            />
                        </div>
                        <div className="h-[1px] flex-1 bg-gray-200 mx-2"></div>
                        <div className="flex flex-col items-center">
                            <SmartTimeInput
                                disabled={isLocked}
                                className="bg-transparent text-base font-bold text-gray-800 outline-none w-12 text-center"
                                value={flight.arrTime}
                                onChange={(val: string) => onUpdate({ arrTime: val })}
                                placeholder="--:--"
                            />
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleAutoImport}
                    disabled={isLoading || isLocked}
                    className={cn(
                        isLocked ? "text-gray-200 cursor-not-allowed" : "text-gray-300 hover:text-teal-500"
                    )}
                >
                    <Wand2 size={14} className={isLoading ? "animate-spin" : ""} />
                </button>
            </div>
        </div>
    );
});

FlightCard.displayName = 'FlightCard';

