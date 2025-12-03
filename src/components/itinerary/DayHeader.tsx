import React from 'react';
import { Edit3, Loader2 } from 'lucide-react';
import { DayLocationInput } from '../common/DayLocationInput';
import { useWeather } from '../../hooks/useWeather';
import type { Day, Spot } from '../../types';
import { formatDate } from '../../utils/date';
import { DEFAULT_MAP_CENTER } from '../../constants';

interface DayHeaderProps {
    day: Day;
    dayIndex: number;
    startDate: string;
    isLocked: boolean;
    isMapLoaded: boolean;
    validSpots: Spot[];
    onLocationChange: (value: string) => void;
    onLocationSelect: (lat: number, lng: number, name: string) => void;
}

export const DayHeader: React.FC<DayHeaderProps> = ({
    day,
    dayIndex,
    startDate,
    isLocked,
    isMapLoaded,
    validSpots,
    onLocationChange,
    onLocationSelect
}) => {
    const currentDateObj = formatDate(startDate, dayIndex);
    
    const weatherLocation = (() => {
        if (day.customLat && day.customLng) {
            return { lat: day.customLat, lng: day.customLng };
        }
        if (validSpots.length > 0) {
            return validSpots[0].location;
        }
        return DEFAULT_MAP_CENTER;
    })();
    
    const { weather, loading: weatherLoading } = useWeather(
        weatherLocation.lat,
        weatherLocation.lng,
        startDate,
        dayIndex
    );
    const displayedLocationName = day.customLocation || '';

    return (
        <div className="px-4 py-3 shrink-0">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex justify-between items-center h-[72px]">
                <div className="flex items-center gap-4">
                    <div className="text-center min-w-[50px]">
                        <div className="text-sm font-bold text-gray-800">
                            {currentDateObj.month}/{currentDateObj.date}
                        </div>
                        <div className="text-xs font-bold text-gray-400">({currentDateObj.day})</div>
                    </div>
                    <div className="h-8 w-[1px] bg-gray-100"></div>
                    <div>
                        <div className="text-[10px] font-bold text-gray-400 mb-0.5">當日定位</div>
                        <div className="flex items-center gap-1 text-gray-700 font-bold group text-sm">
                            {isMapLoaded && (
                                <DayLocationInput
                                    value={displayedLocationName}
                                    placeholder="輸入區域..."
                                    disabled={isLocked}
                                    onChange={onLocationChange}
                                    onLocationSelect={onLocationSelect}
                                />
                            )}
                            {!isLocked && <Edit3 size={12} className="text-gray-300 group-hover:text-teal-500" />}
                        </div>
                    </div>
                </div>
                <div className="text-right flex flex-col items-end justify-center">
                    {weatherLoading ? (
                        <Loader2 className="animate-spin text-gray-300" size={16} />
                    ) : weather ? (
                        <>
                            {weather.icon}
                            <div className="text-xs font-bold text-gray-600 mt-1">{weather.tempRange}</div>
                        </>
                    ) : (
                        <div className="text-xs text-gray-300">無資料</div>
                    )}
                </div>
            </div>
        </div>
    );
};

