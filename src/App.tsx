import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap, Marker, Polyline, Autocomplete, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Map as MapIcon, MapPin, Search, Plus, Trash2, Sun, CloudRain, CloudSun, Loader2, FolderOpen, FilePlus, X, Menu, CloudFog, CloudLightning, Snowflake, PlaneTakeoff, PlaneLanding, Wand2, Settings2, Tag, Edit3, Clock, StickyNote, AlertCircle, Languages, Banknote, Calendar as CalendarIcon, LocateFixed, Wallet, Settings, List, Camera, Mic, ArrowRightLeft, Calculator, ExternalLink, CheckCircle2 } from 'lucide-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// --- 0. 設定與常數 ---
const LIBRARIES: ("places")[] = ["places"];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const FLIGHT_API_KEY = import.meta.env.VITE_AVIATION_KEY || "";

const generateId = () => Math.random().toString(36).substr(2, 9);

const DEFAULT_CATEGORIES = [
    '觀光景點', '美食餐廳', '購物行程', '咖啡廳', 
    '神社/寺廟', '博物館/美術館', '公園/自然', 
    '居酒屋/酒吧', '甜點/下午茶', '伴手禮', 
    '藥妝店', '飯店/住宿', '交通/車站', 
    '主題樂園', '便利商店', '休息點'
];

// --- 1. 資料模型與狀態管理 (Zustand) ---

interface Spot {
  id: string;
  name: string;
  category: string;
  website?: string;
  note?: string;
  startTime?: string;
  endTime?: string;
  location: { lat: number; lng: number };
  address?: string;
  rating?: number;
}

interface Day {
  id: string;
  spots: Spot[];
  customLocation?: string; 
  customLat?: number;      
  customLng?: number;      
}

interface FlightInfo {
    flightNo: string;
    depTime: string;
    arrTime: string;
    depAirport: string;
    arrAirport: string;
}

interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  outbound: FlightInfo;
  inbound: FlightInfo;
  days: Day[];
  currentDayIndex: number;
}

interface ItineraryStore {
  trips: Trip[];
  activeTripId: string;
  savedCategories: string[];
  
  // Actions
  createTrip: () => void;
  switchTrip: (id: string) => void;
  deleteTrip: (id: string) => void;
  updateTripInfo: (info: Partial<Trip>) => void;
  updateFlight: (type: 'outbound' | 'inbound', info: Partial<FlightInfo>) => void;

  setCurrentDayIndex: (index: number) => void;
  addDay: () => void;
  deleteDay: (index: number) => void;
  reorderDays: (oldIndex: number, newIndex: number) => void; 
  updateDayInfo: (dayIndex: number, info: Partial<Day>) => void; 

  addSpot: (spot: Omit<Spot, 'id' | 'category'>) => void;
  addEmptySpot: () => void;
  removeSpot: (spotId: string) => void;
  reorderSpots: (activeId: string, overId: string) => void;
  
  updateSpot: (id: string, info: Partial<Spot>) => void;
  addCategory: (category: string) => void;
  removeCategory: (category: string) => void;
  
  importData: (data: Trip[]) => void;
}

const INITIAL_TRIP_ID = 'trip-default';
const DEFAULT_FLIGHT: FlightInfo = { flightNo: '', depTime: '', arrTime: '', depAirport: '', arrAirport: '' };

const INITIAL_TRIPS: Trip[] = [
  {
    id: INITIAL_TRIP_ID,
    name: '我的東京冒險',
    destination: '日本東京',
    startDate: new Date().toISOString().split('T')[0],
    outbound: { ...DEFAULT_FLIGHT },
    inbound: { ...DEFAULT_FLIGHT },
    currentDayIndex: 0,
    days: [
      {
        id: 'day-1',
        spots: [
          { id: '1', name: '淺草寺 (雷門)', category: '神社/寺廟', startTime: '10:00', endTime: '12:00', location: { lat: 35.7147, lng: 139.7967 }, website: 'https://www.senso-ji.jp/', rating: 4.7 },
          { id: '2', name: '晴空塔敘敘苑', category: '美食餐廳', startTime: '14:00', endTime: '16:00', location: { lat: 35.7100, lng: 139.8107 }, note: '記得要訂位，靠窗位置風景最好！', rating: 4.5 },
        ]
      }
    ]
  }
];

const useStore = create<ItineraryStore>()(
  persist(
    (set) => ({
      trips: INITIAL_TRIPS,
      activeTripId: INITIAL_TRIP_ID,
      savedCategories: DEFAULT_CATEGORIES,

      createTrip: () => set((state) => {
        const newId = generateId();
        const newTrip: Trip = {
          id: newId,
          name: `新行程 ${state.trips.length + 1}`,
          destination: '台北',
          startDate: new Date().toISOString().split('T')[0],
          outbound: { ...DEFAULT_FLIGHT },
          inbound: { ...DEFAULT_FLIGHT },
          currentDayIndex: 0,
          days: [{ id: generateId(), spots: [] }]
        };
        return { trips: [...state.trips, newTrip], activeTripId: newId };
      }),

      switchTrip: (id) => set({ activeTripId: id }),
      
      deleteTrip: (id) => set((state) => {
        if (state.trips.length <= 1) return state;
        const newTrips = state.trips.filter(t => t.id !== id);
        return { trips: newTrips, activeTripId: state.activeTripId === id ? newTrips[0].id : state.activeTripId };
      }),

      updateTripInfo: (info) => set((state) => ({
        trips: state.trips.map(t => t.id === state.activeTripId ? { ...t, ...info } : t)
      })),

      updateFlight: (type, info) => set((state) => ({
        trips: state.trips.map(t => {
            if (t.id !== state.activeTripId) return t;
            return { ...t, [type]: { ...t[type], ...info } };
        })
      })),

      setCurrentDayIndex: (index) => set((state) => ({
        trips: state.trips.map(t => t.id === state.activeTripId ? { ...t, currentDayIndex: index } : t)
      })),

      addDay: () => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          const newDays = [...t.days, { id: generateId(), spots: [] }];
          return { ...t, days: newDays, currentDayIndex: newDays.length - 1 };
        })
      })),

      deleteDay: (index) => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          if (t.days.length <= 1) return t;
          const newDays = t.days.filter((_, i) => i !== index);
          const newIndex = t.currentDayIndex >= newDays.length ? newDays.length - 1 : t.currentDayIndex;
          return { ...t, days: newDays, currentDayIndex: newIndex };
        })
      })),

      reorderDays: (oldIndex, newIndex) => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          const newDays = arrayMove(t.days, oldIndex, newIndex);
          return { ...t, days: newDays };
        })
      })),

      updateDayInfo: (dayIndex, info) => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          const newDays = [...t.days];
          if (newDays[dayIndex]) {
             newDays[dayIndex] = { ...newDays[dayIndex], ...info };
          }
          return { ...t, days: newDays };
        })
      })),

      addSpot: (spotData) => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          const currentDay = t.days[t.currentDayIndex];
          if (!currentDay) return t;
          const newSpot: Spot = { ...spotData, id: generateId(), category: '觀光景點', startTime: '', endTime: '' };
          const newDays = [...t.days];
          newDays[t.currentDayIndex] = { ...currentDay, spots: [...currentDay.spots, newSpot] };
          return { ...t, days: newDays };
        })
      })),

      addEmptySpot: () => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          const currentDay = t.days[t.currentDayIndex];
          if (!currentDay) return t;
          const newSpot: Spot = { 
              id: generateId(), 
              name: '新行程', 
              category: '觀光景點', 
              location: { lat: 0, lng: 0 }, 
              startTime: '', 
              endTime: '' 
          };
          const newDays = [...t.days];
          newDays[t.currentDayIndex] = { ...currentDay, spots: [...currentDay.spots, newSpot] };
          return { ...t, days: newDays };
        })
      })),

      removeSpot: (spotId) => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          const currentDay = t.days[t.currentDayIndex];
          const newDays = [...t.days];
          newDays[t.currentDayIndex] = { ...currentDay, spots: currentDay.spots.filter(s => s.id !== spotId) };
          return { ...t, days: newDays };
        })
      })),

      reorderSpots: (activeId, overId) => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          const currentSpots = t.days[t.currentDayIndex].spots;
          const oldIndex = currentSpots.findIndex((s) => s.id === activeId);
          const newIndex = currentSpots.findIndex((s) => s.id === overId);
          if (oldIndex === -1 || newIndex === -1) return t;
          const newDays = [...t.days];
          newDays[t.currentDayIndex] = { ...t.days[t.currentDayIndex], spots: arrayMove(currentSpots, oldIndex, newIndex) };
          return { ...t, days: newDays };
        })
      })),

      updateSpot: (id, info) => set((state) => ({
        trips: state.trips.map(t => {
            if (t.id !== state.activeTripId) return t;
            const currentDay = t.days[t.currentDayIndex];
            const newDays = [...t.days];
            newDays[t.currentDayIndex] = {
                ...currentDay,
                spots: currentDay.spots.map(s => s.id === id ? { ...s, ...info } : s)
            };
            return { ...t, days: newDays };
        })
      })),

      addCategory: (category) => set((state) => {
          if (state.savedCategories.includes(category)) return state;
          return { savedCategories: [...state.savedCategories, category] };
      }),

      removeCategory: (category) => set((state) => ({
          savedCategories: state.savedCategories.filter(c => c !== category)
      })),

      importData: (newTrips) => set(() => ({
          trips: newTrips,
          activeTripId: newTrips.length > 0 ? newTrips[0].id : INITIAL_TRIP_ID
      }))
    }),
    { name: 'travel-planner-storage-v29' } 
  )
);

// --- 2. API 與 輔助功能 ---

const fetchFlightData = async (flightNo: string) => {
    if (!flightNo) return null;
    
    try {
        if (FLIGHT_API_KEY) {
            const response = await fetch(`http://api.aviationstack.com/v1/flights?access_key=${FLIGHT_API_KEY}&flight_iata=${flightNo}`);
            const data = await response.json();
            
            if (data && data.data && data.data.length > 0) {
                const flight = data.data[0];
                return {
                    depTime: flight.departure.scheduled ? new Date(flight.departure.scheduled).toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit'}) : '--:--',
                    arrTime: flight.arrival.scheduled ? new Date(flight.arrival.scheduled).toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit'}) : '--:--',
                    depAirport: flight.departure.iata || '',
                    arrAirport: flight.arrival.iata || ''
                };
            }
        }
    } catch (error) {
        console.error("Flight API Error:", error);
    }

    return new Promise<{depTime: string, arrTime: string, depAirport: string, arrAirport: string} | null>((resolve) => {
        setTimeout(() => {
            const cleanNo = flightNo.trim().toUpperCase();
            if (cleanNo.includes('BR')) resolve({ depTime: '08:50', arrTime: '13:15', depAirport: 'TPE T2', arrAirport: 'NRT T1' });
            else if (cleanNo.includes('JX')) resolve({ depTime: '10:30', arrTime: '14:45', depAirport: 'TPE T1', arrAirport: 'KIX T1' });
            else resolve({ depTime: '10:00', arrTime: '14:00', depAirport: 'TPE', arrAirport: 'NRT' });
        }, 600);
    });
};

const formatDate = (startDateStr: string, dayOffset: number) => {
  if (!startDateStr) return { month: '??', date: '??', day: '??', full: '未定' };
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) return { month: '??', date: '??', day: '??', full: '未定' };
  date.setDate(date.getDate() + dayOffset);
  return {
      month: (date.getMonth() + 1).toString(),
      date: date.getDate().toString().padStart(2, '0'),
      day: date.toLocaleDateString('zh-TW', { weekday: 'short' }),
      full: date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }),
      iso: date.toISOString().split('T')[0]
  };
};

const getCategoryStyle = (category: string) => {
    const map: Record<string, string> = {
        '觀光景點': 'border-red-400 text-red-600 bg-red-50',
        '美食餐廳': 'border-orange-400 text-orange-600 bg-orange-50',
        '購物行程': 'border-yellow-400 text-yellow-600 bg-yellow-50',
        '咖啡廳': 'border-amber-400 text-amber-600 bg-amber-50',
        '神社/寺廟': 'border-stone-400 text-stone-600 bg-stone-50',
    };
    return map[category] || 'border-gray-400 text-gray-600 bg-gray-50';
};

const useWeather = (lat: number, lng: number, dateStr: string, dayOffset: number) => {
    const [weather, setWeather] = useState<{ icon: React.ReactNode; text: string; tempRange: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [autoLocationName, setAutoLocationName] = useState<string>("");

    useEffect(() => {
        const fetchWeather = async () => {
            if (!lat || !lng || lat === 0) return;
            setLoading(true);
            try {
                const targetDate = new Date(dateStr);
                targetDate.setDate(targetDate.getDate() + dayOffset);
                const targetDateIso = targetDate.toISOString().split('T')[0];
                const today = new Date();
                const diffTime = targetDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                
                const isForecastAvailable = diffDays >= -2 && diffDays <= 14; 
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto${isForecastAvailable ? `&start_date=${targetDateIso}&end_date=${targetDateIso}` : ''}`;
                
                const res = await fetch(url);
                const data = await res.json();

                if (data.daily && data.daily.weathercode && data.daily.weathercode.length > 0) {
                    const code = data.daily.weathercode[0];
                    const min = Math.round(data.daily.temperature_2m_min[0]);
                    const max = Math.round(data.daily.temperature_2m_max[0]);
                    let text = "晴朗";
                    let icon = <Sun size={24} className="text-orange-400" />;
                    if (code > 0) {
                        if (code <= 3) { text="多雲"; icon=<CloudSun size={24} className="text-yellow-500"/>; }
                        else if (code <= 48) { text="霧"; icon=<CloudFog size={24} className="text-gray-400"/>; }
                        else if (code <= 67) { text="雨"; icon=<CloudRain size={24} className="text-blue-400"/>; }
                        else if (code <= 77) { text="雪"; icon=<Snowflake size={24} className="text-blue-200"/>; }
                        else if (code >= 95) { text="雷雨"; icon=<CloudLightning size={24} className="text-purple-500"/>; }
                        else { text="陰"; icon=<CloudSun size={24} className="text-gray-500"/>; }
                    }
                    setWeather({ icon, text, tempRange: `${min}° - ${max}°` });
                } else {
                     setWeather({ icon: <CloudSun size={24}/>, text: "暫無", tempRange: "--" });
                }
            } catch (e) {
                setWeather(null);
            } finally {
                setLoading(false);
            }
        };
        fetchWeather();
    }, [lat, lng, dateStr, dayOffset]);

    useEffect(() => {
        if (!lat || !lng || lat === 0) return;
        if (!window.google || !window.google.maps || !window.google.maps.Geocoder) return;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng }, language: 'zh-TW' }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                const components = results[0].address_components;
                const city = components.find(c => c.types.includes('locality'))?.long_name;
                const prefecture = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
                setAutoLocationName(city || prefecture || "未知區域");
            }
        });
    }, [lat, lng]); 

    return { weather, loading, autoLocationName };
};

// --- 3. UI 元件 ---

const SmartTimeInput = ({ value, onChange, placeholder, className }: any) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.currentTarget.blur(); }
    };
    return ( <input type="text" placeholder={placeholder} className={className} value={value || ''} onChange={(e) => onChange(e.target.value)} onKeyDown={handleKeyDown} /> );
};

const MagicTimeInput = ({ value, onChange, placeholder, className }: any) => {
    const [tempValue, setTempValue] = useState(value);

    useEffect(() => setTempValue(value), [value]);

    const handleBlur = () => {
        let clean = tempValue.replace(/\D/g, ''); 
        if (!clean) return;

        let formatted = clean;

        if (clean.length === 1) { 
            formatted = `0${clean}:00`;
        } else if (clean.length === 2) { 
             formatted = `${clean}:00`;
        } else if (clean.length === 3) { 
             formatted = `${clean.substring(0,2)}:${clean.substring(2)}0`;
        } else if (clean.length >= 4) { 
             formatted = `${clean.substring(0,2)}:${clean.substring(2,4)}`;
        }

        if (formatted.includes(':')) {
            let [h, m] = formatted.split(':').map(Number);
            if (h > 23) h = 23;
            if (m > 59) m = 59;
            formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        onChange(formatted);
        setTempValue(formatted);
    };

    return ( 
        <input 
            type="text" 
            placeholder={placeholder} 
            className={className} 
            value={tempValue || ''} 
            onChange={(e) => setTempValue(e.target.value)} 
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        /> 
    );
};

const DayLocationInput = ({ value, placeholder, onChange, onLocationSelect }: any) => {
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const onLoad = (autocomplete: google.maps.places.Autocomplete) => { autocompleteRef.current = autocomplete; };
    const onPlaceChanged = () => {
        if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (!place || !place.geometry || !place.geometry.location) return;
            onLocationSelect(place.geometry.location.lat(), place.geometry.location.lng(), place.name || "");
        }
    };
    return (
        <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged} types={['(regions)']}>
             <input className="bg-transparent outline-none w-full text-gray-600 font-medium placeholder-gray-300" placeholder={placeholder} value={value} onChange={(e)=>onChange(e.target.value)} />
        </Autocomplete>
    );
};

const SpotDetailModal = ({ spot, isOpen, onClose, onUpdate, onRemove, savedCategories, addCategory, removeCategory, setPickingLocation }: any) => {
    if (!isOpen) return null;
    
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 font-sans">
                
                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <Settings2 size={18} className="text-teal-600"/> 景點詳細設定
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"><X size={20}/></button>
                </div>

                <div className="p-5 overflow-y-auto">
                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">景點名稱</label>
                        <input 
                            className="w-full text-lg font-bold text-gray-800 border-b-2 border-gray-200 focus:border-teal-500 outline-none py-1 bg-transparent transition-colors"
                            value={spot.name}
                            onChange={(e) => onUpdate(spot.id, { name: e.target.value })}
                        />
                    </div>
                    
                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">位置設定</label>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => { onClose(); setPickingLocation(spot.id); }}
                                className="flex-1 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-teal-100 transition-all"
                             >
                                <LocateFixed size={16} /> 點選地圖設定位置
                             </button>
                             {spot.location.lat !== 0 && (
                                <div className="text-xs text-gray-400 flex items-center px-2">已設定</div>
                             )}
                        </div>
                    </div>

                    <div className="mb-5">
                         <label className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><Clock size={12}/>時間</label>
                         <MagicTimeInput 
                             className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 font-bold text-gray-700 focus:border-teal-400 outline-none" 
                             value={spot.startTime || ''} 
                             onChange={(val: string) => onUpdate(spot.id, { startTime: val })} 
                             placeholder="輸入時間 (例: 19 -> 19:00)"
                         />
                    </div>

                    <div className="mb-5">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1"><Tag size={12}/> 景點類型</label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                            {savedCategories.map((cat: string) => {
                                const isDefault = DEFAULT_CATEGORIES.includes(cat);
                                const isConfirming = confirmDeleteCat === cat;

                                return (
                                    <div key={cat} className="relative group/cat">
                                        <button 
                                            onClick={() => onUpdate(spot.id, { category: cat })}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${spot.category === cat ? getCategoryStyle(cat) + ' ring-2 ring-offset-1 ring-teal-200' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                        >
                                            {cat}
                                        </button>
                                        
                                        {!isDefault && (
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
                                                className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] border transition-all z-10 
                                                    ${isConfirming ? 'bg-red-500 text-white border-red-600 scale-110' : 'bg-gray-100 text-gray-400 border-gray-200 opacity-0 group-hover/cat:opacity-100 hover:bg-red-100 hover:text-red-500'}`}
                                                title={isConfirming ? "再點一次刪除" : "刪除分類"}
                                            >
                                                {isConfirming ? '!' : 'x'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="flex items-center gap-1 px-2 rounded-full border border-dashed border-gray-300 focus-within:border-teal-400 bg-gray-50/50">
                                <Plus size={12} className="text-gray-400"/>
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
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1"><StickyNote size={12}/> 備註 & 筆記</label>
                        <textarea 
                            className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg p-3 outline-none focus:border-teal-300 min-h-[80px] bg-gray-50 focus:bg-white transition-colors resize-none" 
                            placeholder="寫點什麼..." 
                            value={spot.note || ''} 
                            onChange={(e) => onUpdate(spot.id, { note: e.target.value })} 
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-3">
                    <div className="flex-1 flex gap-2">
                         {confirmDelete ? (
                             <>
                                <button 
                                    onClick={() => { onRemove(spot.id); onClose(); }}
                                    className="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all flex justify-center items-center gap-2"
                                >
                                    <AlertCircle size={16}/> 確定刪除
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
                                <Trash2 size={16}/> 刪除景點
                            </button>
                         )}
                    </div>
                    
                    {!confirmDelete && (
                        <button onClick={onClose} className="px-6 py-2 rounded-lg bg-teal-600 text-white font-bold text-sm hover:bg-teal-700 shadow-sm active:scale-95 transition-all">
                            完成
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

const SpotCard = ({ spot, index, updateSpot, removeSpot, savedCategories, addCategory, removeCategory, setPickingLocation, onAutoLocate }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: spot.id });
    const [isModalOpen, setModalOpen] = useState(false);
    
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isAutoLocating, setIsAutoLocating] = useState(false);

    const style = { 
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 1,
        position: 'relative' as const 
    };

    const categoryStyle = getCategoryStyle(spot.category || 'other');
    const hasLocation = spot.location.lat !== 0 && spot.location.lng !== 0;

    const handleNameKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
             e.currentTarget.blur();
             if (spot.name.trim()) {
                 setIsAutoLocating(true);
                 await onAutoLocate(spot.id, spot.name);
                 setIsAutoLocating(false);
             }
        }
    };

    return (
      <>
        <div ref={setNodeRef} style={style} className="relative mb-3 group touch-none">
            <div className={`bg-white rounded-xl shadow-sm border border-gray-100 hover:border-teal-200 transition-all flex items-stretch p-0 overflow-hidden h-[76px]`}>
                
                <div {...attributes} {...listeners} className="w-[70px] bg-gray-50 border-r border-gray-100 flex flex-col justify-center items-center cursor-grab hover:bg-gray-100 transition-colors shrink-0">
                     <div className="text-[10px] text-gray-400 font-bold mb-0.5 uppercase">時間</div>
                     <div className="text-sm font-black text-gray-700 tracking-tight">{spot.startTime || '--:--'}</div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2 gap-1 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => setModalOpen(true)}>
                    <input 
                        className="font-bold text-gray-800 text-sm truncate bg-transparent outline-none border-b border-transparent focus:border-teal-300 w-full placeholder-gray-400"
                        value={spot.name}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateSpot(spot.id, { name: e.target.value })}
                        onKeyDown={handleNameKeyDown}
                        placeholder="輸入景點 (按Enter自動定位)"
                    />
                    
                    <div className="flex items-center gap-2">
                         {isAutoLocating ? (
                             <div className="text-xs text-teal-500 flex items-center gap-1 animate-pulse"><Loader2 size={10} className="animate-spin"/> 搜尋定位中...</div>
                         ) : hasLocation ? (
                            <div className="text-xs text-gray-400 flex items-center gap-1 truncate max-w-[150px]">
                                <MapPin size={10} className="text-teal-500" /> {spot.address || '地圖點位'}
                            </div>
                        ) : (
                            <div className="text-xs text-orange-400 flex items-center gap-1">
                                <AlertCircle size={10} /> 點此設定地點 或 按Enter搜尋
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <div className={`text-[9px] px-1.5 py-0 rounded-md border ${categoryStyle} flex items-center gap-1 inline-block`}>
                           {spot.category}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col justify-center items-center px-2 border-l border-gray-50 gap-2 w-[40px]">
                     {hasLocation ? (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${spot.location.lat},${spot.location.lng}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-teal-600 transition-colors" title="Google Map">
                             <MapIcon size={18} />
                        </a>
                     ) : (
                        <button onClick={(e) => { e.stopPropagation(); setPickingLocation(spot.id); }} className="text-orange-300 hover:text-orange-500" title="設定位置"><LocateFixed size={18}/></button>
                     )}
                     
                     <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if(isConfirmingDelete) {
                                removeSpot(spot.id);
                            } else {
                                setIsConfirmingDelete(true);
                                setTimeout(() => setIsConfirmingDelete(false), 3000); // 3秒後自動取消
                            }
                        }} 
                        className={`transition-all ${isConfirmingDelete ? 'text-red-500 bg-red-100 rounded-full p-1' : 'text-gray-300 hover:text-red-400 group-hover:opacity-100 md:opacity-0'}`}
                        title={isConfirmingDelete ? "再次點擊以刪除" : "刪除"}
                    >
                         {isConfirmingDelete ? <Trash2 size={14} className="animate-bounce"/> : <Trash2 size={16}/>}
                    </button>
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
        />
      </>
    );
};

const SortableDayTab = ({ day, index, isActive, onClick, displayDate, onDelete, showDelete }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: day.id });
    const style = { transform: CSS.Translate.toString(transform), transition };
    const [isConfirming, setIsConfirming] = useState(false);

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group flex-shrink-0 touch-none">
            <button 
                onClick={onClick} 
                className={`w-[60px] h-[60px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer select-none border-2 relative overflow-hidden
                ${isActive 
                    ? 'bg-white border-white text-teal-700 shadow-md transform scale-105 z-10' 
                    : 'bg-teal-800/40 border-transparent text-teal-100 hover:bg-teal-700'}`}
            >
                <span className="text-[10px] font-medium opacity-80 uppercase">{displayDate}</span>
                <span className="text-lg font-bold">D{index + 1}</span>
            </button>

            {showDelete && (
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
                    className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-sm border border-white transition-all z-20 
                    ${isConfirming ? 'bg-red-600 text-white scale-110' : 'bg-gray-200 text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white'}`}
                    title={isConfirming ? "再點一次刪除" : "刪除這一天"}
                    onMouseDown={(e) => e.stopPropagation()} 
                >
                    {isConfirming ? '!' : <X size={12}/>}
                </button>
            )}
        </div>
    );
};

// ✨ 5. 機票卡片新增 Enter 鍵觸發搜尋
const FlightCard = ({ type, flight, onUpdate }: any) => {
    const [isLoading, setIsLoading] = useState(false);
    const handleAutoImport = async () => {
        if (!flight.flightNo) return;
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
        <div className={`mb-3 relative rounded-xl border-2 border-dashed p-3 shadow-sm transition-all bg-white hover:border-teal-200 group`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full text-white shrink-0 ${type === 'outbound' ? 'bg-blue-400' : 'bg-orange-400'}`}>{type === 'outbound' ? <PlaneTakeoff size={18} /> : <PlaneLanding size={18} />}</div>
                <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                        <input 
                            className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none uppercase placeholder-gray-300" 
                            placeholder="航班號" 
                            value={flight.flightNo} 
                            onChange={(e) => onUpdate({ flightNo: e.target.value })}
                            onKeyDown={handleKeyDown} 
                        />
                    </div>
                    <div className="col-span-9 flex items-center justify-between text-gray-500">
                         <div className="flex flex-col items-center"><SmartTimeInput className="bg-transparent text-base font-bold text-gray-800 outline-none w-12 text-center" value={flight.depTime} onChange={(val: string)=>onUpdate({depTime: val})} placeholder="--:--" /></div>
                         <div className="h-[1px] flex-1 bg-gray-200 mx-2"></div>
                         <div className="flex flex-col items-center"><SmartTimeInput className="bg-transparent text-base font-bold text-gray-800 outline-none w-12 text-center" value={flight.arrTime} onChange={(val: string)=>onUpdate({arrTime: val})} placeholder="--:--" /></div>
                    </div>
                </div>
                <button onClick={handleAutoImport} disabled={isLoading} className="text-gray-300 hover:text-teal-500"><Wand2 size={14} className={isLoading ? "animate-spin" : ""}/></button>
            </div>
        </div>
    );
};

// ✨ 2 & 3. HeaderControls 修改：移除綠色框，對齊調整
const HeaderControls = ({ onPlacePreview, onTextSearch }: any) => {
    const [inputValue, setInputValue] = useState("");
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const onLoad = (autocomplete: google.maps.places.Autocomplete) => { autocompleteRef.current = autocomplete; };
    const onPlaceChanged = () => {
      if (autocompleteRef.current) {
        const place = autocompleteRef.current.getPlace();
        if (!place.geometry || !place.geometry.location) return;
        onPlacePreview(place);
        setInputValue(""); 
      }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            onTextSearch(inputValue);
        }
    };

    return (
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 font-sans w-[calc(100%-2rem)] max-w-[400px]">
         <div className="relative flex-1 shadow-lg rounded-xl bg-white border border-gray-100 flex min-w-0">
            <div className="pl-3 flex items-center pointer-events-none z-20"><Search size={16} className="text-gray-400" /></div>
            
            <div className="flex-1 min-w-0">
                <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged} options={{ fields: ["geometry", "name", "formatted_address", "place_id", "rating", "website"] }}>
                    <input 
                        type="text" 
                        placeholder="搜尋地點 (按Enter多點搜尋)..." 
                        className="block w-full pl-2 pr-3 py-3 rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none min-w-0 h-full bg-transparent" 
                        value={inputValue} 
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </Autocomplete>
            </div>
        </div>
      </div>
    );
};

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { trips, activeTripId, createTrip, switchTrip, deleteTrip, trips: allTrips, importData } = useStore();
    return (
        <div className={`fixed inset-y-0 left-0 z-[100] w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-teal-600 text-white">
                <h2 className="font-bold flex items-center gap-2"><FolderOpen size={20}/> 我的行程庫</h2>
                <button onClick={onClose} className="hover:bg-teal-700 p-1 rounded"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto h-full pb-20 flex flex-col gap-2">
                {trips.map(trip => (
                    <div key={trip.id} onClick={() => { switchTrip(trip.id); onClose(); }} className={`group p-3 rounded-lg cursor-pointer border transition-all ${activeTripId === trip.id ? 'bg-teal-50 border-teal-500 shadow-sm' : 'bg-white border-gray-200 hover:border-teal-300'}`}>
                        <div className="flex justify-between items-start">
                            <h3 className={`font-bold ${activeTripId === trip.id ? 'text-teal-700' : 'text-gray-700'}`}>{trip.name}</h3>
                            {trips.length > 1 && (<button onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{trip.destination} • {trip.days.length} 天</p>
                    </div>
                ))}
                <button onClick={createTrip} className="w-full py-3 mt-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg flex items-center justify-center gap-2 hover:border-teal-500 hover:text-teal-600 transition-colors font-medium"><FilePlus size={18} /> 建立新行程</button>
            </div>
        </div>
    );
};

const TranslateView = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 font-sans">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Google 翻譯捷徑</h2>
            <p className="text-gray-400 mb-8">請選擇您需要的翻譯模式</p>
            
            <div className="w-full max-w-sm flex flex-col gap-4">
                <a href="https://translate.google.com/?op=images" target="_blank" rel="noreferrer" className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-orange-400 to-red-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer">
                    <div className="flex flex-col items-start"><span className="text-xs opacity-80 mb-1">菜單 / 看板</span><span className="text-2xl font-bold">照相翻譯 📸</span></div><Camera size={28} />
                </a>
                <a href="https://translate.google.com/?sl=zh-TW&tl=ja&op=translate" target="_blank" rel="noreferrer" className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer">
                    <div className="flex flex-col items-start"><span className="text-xs opacity-80 mb-1">我說中文 (轉日文)</span><span className="text-2xl font-bold">CH → JA</span></div><ExternalLink size={24} />
                </a>
                <a href="https://translate.google.com/?sl=ja&tl=zh-TW&op=translate" target="_blank" rel="noreferrer" className="flex items-center justify-between p-6 rounded-2xl bg-white text-gray-800 border-2 border-gray-100 shadow-sm hover:border-gray-300 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer">
                     <div className="flex flex-col items-start"><span className="text-xs text-gray-400 mb-1">對方說日文 (轉中文)</span><span className="text-2xl font-bold text-gray-700">JA → CH</span></div><ExternalLink size={24} className="text-gray-300"/>
                </a>
            </div>
        </div>
    );
};

const BudgetView = () => {
    const [jpy, setJpy] = useState("");
    const [twd, setTwd] = useState<number | null>(null);
    const RATE = 0.2;
    const handleCalculate = () => {
        const val = parseFloat(jpy);
        if (!isNaN(val)) { setTwd(Math.floor(val * RATE)); } else { setTwd(null); }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 font-sans bg-gray-50">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <div className="flex items-center justify-center gap-2 text-teal-600 mb-6"><Banknote size={24}/><h2 className="text-xl font-bold">旅遊匯率換算</h2></div>
                <div className="mb-6">
                    <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">日幣 (JPY)</label>
                    <div className="relative">
                        <input type="number" className="w-full text-3xl font-bold text-gray-800 border-b-2 border-gray-200 focus:border-teal-500 outline-none py-2 bg-transparent transition-colors placeholder-gray-200" placeholder="0" value={jpy} onChange={(e) => setJpy(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCalculate()}/>
                        <span className="absolute right-0 bottom-3 text-sm font-bold text-gray-400">¥</span>
                    </div>
                </div>
                <div className="flex justify-center mb-6"><div className="bg-gray-100 p-2 rounded-full text-gray-400 rotate-90"><ArrowRightLeft size={20}/></div></div>
                <div className="mb-8">
                     <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">台幣 (TWD) <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded ml-2">匯率: {RATE}</span></label>
                     <div className="text-4xl font-black text-teal-600 py-2 border-b-2 border-transparent">{twd !== null ? `$${twd.toLocaleString()}` : '--'}</div>
                </div>
                <button onClick={handleCalculate} className="w-full py-4 rounded-xl bg-teal-600 text-white font-bold text-lg hover:bg-teal-700 shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><Calculator size={20}/> 計算</button>
            </div>
             <p className="mt-8 text-xs text-gray-400 text-center">✨ 弟弟的小提醒：匯率是用 0.2 估算的喔！<br/>實際還是要看刷卡當下的匯率～☕️</p>
        </div>
    );
};

// --- 4. 主程式 ---

export default function VacationPlanner() {
  const { 
      trips, activeTripId, savedCategories,
      setCurrentDayIndex, addDay, deleteDay,
      addSpot, addEmptySpot, removeSpot, reorderSpots, updateSpot, addCategory, removeCategory,
      updateTripInfo, updateFlight, reorderDays, updateDayInfo
  } = useStore();
  
  const activeTrip = trips.find(t => t.id === activeTripId) || trips[0];
  const { days, currentDayIndex, startDate, name: tripName, outbound, inbound } = activeTrip;

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string; address: string; placeId?: string; rating?: number; website?: string; existingSpotId?: string } | null>(null);
  const [pickingLocationForSpotId, setPickingLocationForSpotId] = useState<string | null>(null);

  const [editingSpotLocationId, setEditingSpotLocationId] = useState<string | null>(null);

  const [searchCandidates, setSearchCandidates] = useState<google.maps.places.PlaceResult[]>([]);

  const [mobileView, setMobileView] = useState<'map' | 'list'>('list');
  const [rightPanelMode, setRightPanelMode] = useState<'itinerary' | 'translate' | 'budget'>('itinerary');

  const [leftWidth, setLeftWidth] = useState(60); 
  const [isResizing, setIsResizing] = useState(false);
  const startResizing = useCallback(() => { setIsResizing(true); }, []);
  const stopResizing = useCallback(() => { setIsResizing(false); }, []);
  const resize = useCallback((e: MouseEvent) => {
      if (isResizing) {
          const newWidth = (e.clientX / window.innerWidth) * 100;
          if (newWidth > 20 && newWidth < 80) { setLeftWidth(newWidth); }
      }
  }, [isResizing]);

  useEffect(() => {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stopResizing); };
  }, [resize, stopResizing]);

  const onLoadMap = React.useCallback((map: google.maps.Map) => { mapRef.current = map; }, []);
  const onUnmountMap = React.useCallback(() => { mapRef.current = null; }, []);
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: LIBRARIES, language: 'zh-TW' });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) reorderSpots(active.id as string, over?.id as string);
  };

  const currentDayData = days[currentDayIndex] || { spots: [] };
  const currentSpots = currentDayData.spots;
  const validSpots = currentSpots.filter(s => s.location.lat !== 0);

  const mapCenter = useMemo(() => {
      return validSpots.length > 0 ? validSpots[0].location : { lat: 35.6762, lng: 139.6503 };
  }, [validSpots]);

  const weatherLocation = useMemo(() => {
      if (currentDayData.customLat && currentDayData.customLng) return { lat: currentDayData.customLat, lng: currentDayData.customLng };
      if (validSpots.length > 0) return validSpots[0].location;
      return { lat: 35.6762, lng: 139.6503 };
  }, [validSpots, currentDayData]);

  const { weather, loading: weatherLoading, autoLocationName } = useWeather(weatherLocation.lat, weatherLocation.lng, startDate, currentDayIndex);
  const displayedLocationName = currentDayData.customLocation || autoLocationName;

  const handleAutoLocate = async (spotId: string, name: string) => {
      if (!mapRef.current || !name) return;
      const service = new google.maps.places.PlacesService(mapRef.current);
      
      setEditingSpotLocationId(spotId);
      setMobileView('map'); 
      setRightPanelMode('itinerary');

      return new Promise<void>((resolve) => {
          service.findPlaceFromQuery({
              query: name,
              fields: ['name', 'geometry', 'formatted_address', 'place_id', 'rating', 'website']
          }, (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0] && results[0].geometry?.location) {
                  const place = results[0];
                  setSelectedLocation({
                      lat: place.geometry!.location!.lat(),
                      lng: place.geometry!.location!.lng(),
                      name: place.name || name,
                      address: place.formatted_address || '',
                      rating: place.rating,
                      website: place.website
                  });
                  mapRef.current?.panTo(place.geometry!.location!);
                  mapRef.current?.setZoom(15);
              } else {
                  alert("找不到地點，請試著手動定位！💦");
                  setEditingSpotLocationId(null); 
              }
              resolve();
          });
      });
  };

  // ✨ 1. 修改：多點搜尋 radius 改回 3000
  const handleTextSearch = (query: string) => {
      if (!mapRef.current || !query) return;
      const service = new google.maps.places.PlacesService(mapRef.current);
      
      const bounds = mapRef.current.getBounds();
      const center = mapRef.current.getCenter();

      service.textSearch({ 
          query,
          bounds: bounds || undefined,
          location: center, 
          radius: 3000, // 改回 3 公里
      }, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              setSearchCandidates(results);
              setSelectedLocation(null); 
              setEditingSpotLocationId(null); 
              
              const newBounds = new google.maps.LatLngBounds();
              results.forEach(place => {
                  if (place.geometry?.location) {
                      newBounds.extend(place.geometry.location);
                  }
              });
              mapRef.current?.fitBounds(newBounds);
          } else {
              setSearchCandidates([]);
              alert("在目前區域找不到相關結果 😥");
          }
      });
  };

  const onMapClick = React.useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    if (pickingLocationForSpotId) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
             let address = "自選位置";
             if (status === 'OK' && results && results[0]) address = results[0].formatted_address;
             updateSpot(pickingLocationForSpotId, { location: { lat, lng }, address });
             setPickingLocationForSpotId(null);
             setRightPanelMode('itinerary');
             setMobileView('list');
        });
        return;
    }

    setSelectedLocation(null);
    setSearchCandidates([]); 
    setEditingSpotLocationId(null); 

    if ((e as any).placeId) {
        e.stop(); 
        if (!mapRef.current) return;
        const service = new google.maps.places.PlacesService(mapRef.current);
        service.getDetails({ placeId: (e as any).placeId, fields: ['name', 'formatted_address', 'geometry', 'rating', 'website'] }, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
                setSelectedLocation({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), name: place.name || "未知名稱", address: place.formatted_address || "", placeId: (e as any).placeId, rating: place.rating, website: place.website });
            }
        });
    } else {
        setSelectedLocation({ lat, lng, name: "自選地點", address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
    }
  }, [pickingLocationForSpotId, updateSpot]);

  const handlePlacePreview = (place: google.maps.places.PlaceResult) => {
     if (place.geometry && place.geometry.location && place.name) {
         const lat = place.geometry.location.lat();
         const lng = place.geometry.location.lng();
         if(mapRef.current) { mapRef.current.panTo({ lat, lng }); mapRef.current.setZoom(15); }
         setSelectedLocation({ lat, lng, name: place.name, address: place.formatted_address || "", placeId: place.place_id, rating: place.rating, website: place.website });
         setSearchCandidates([]);
         setEditingSpotLocationId(null); 
     }
  };
  
  const handleDayDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (active.id !== over?.id) {
          const oldIndex = days.findIndex(d => d.id === active.id);
          const newIndex = days.findIndex(d => d.id === over?.id);
          reorderDays(oldIndex, newIndex);
          setCurrentDayIndex(newIndex);
      }
  };

  const polylinePath = validSpots.map(s => s.location);
  const dateObj = formatDate(startDate, currentDayIndex);
  const endDateObj = formatDate(startDate, days.length - 1);
  const dateRangeString = `${dateObj.iso} ~ ${endDateObj.iso}`;

  if (loadError) return <div className="p-10 text-red-500 font-bold">載入地圖失敗，請檢查 API Key。</div>;

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden flex-col md:flex-row font-sans relative select-none">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setSidebarOpen(false)} />}
      
      <button 
          onClick={() => setMobileView(prev => prev === 'list' ? 'map' : 'list')}
          className="md:hidden fixed bottom-6 right-6 z-[60] bg-teal-600 text-white p-4 rounded-full shadow-2xl flex items-center justify-center animate-in zoom-in"
      >
          {mobileView === 'list' ? <MapIcon size={24}/> : <List size={24}/>}
      </button>

      {/* ✨ Left Panel (Map) */}
      <div style={{ width: window.innerWidth >= 768 ? `${leftWidth}%` : '100%' }} className={`${mobileView === 'list' ? 'hidden md:block' : 'block'} h-full relative order-2 md:order-1 bg-gray-200`}>
        {!isLoaded ? (<div className="flex h-full w-full items-center justify-center text-gray-500 gap-2"><Loader2 className="animate-spin" /> 地圖載入中...</div>) : (
          <>
            <HeaderControls onPlacePreview={handlePlacePreview} onTextSearch={handleTextSearch} />
            {pickingLocationForSpotId && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40 bg-teal-600 text-white px-4 py-2 rounded-full shadow-lg font-bold animate-bounce flex items-center gap-2">
                    <MapPin size={16}/> 請點擊地圖選擇位置
                    <button onClick={() => setPickingLocationForSpotId(null)} className="bg-white/20 rounded-full p-0.5 ml-2"><X size={12}/></button>
                </div>
            )}
            <GoogleMap 
                mapContainerStyle={{ width: '100%', height: '100%' }} center={mapCenter} zoom={13} 
                options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', styles: [] }} 
                onClick={onMapClick} onDragStart={() => setSelectedLocation(null)} onLoad={onLoadMap} onUnmount={onUnmountMap}
            >
                {validSpots.map((spot, index) => (
                   <Marker 
                        key={spot.id} 
                        position={spot.location} 
                        label={{ text: (index + 1).toString(), color: "white", fontWeight: "bold" }} 
                        onClick={() => { 
                            setSelectedLocation({
                                lat: spot.location.lat, 
                                lng: spot.location.lng,
                                name: spot.name,
                                address: spot.address || '',
                                rating: spot.rating,
                                website: spot.website,
                                existingSpotId: spot.id 
                            });
                            setSearchCandidates([]);
                        }} 
                    />
                ))}
                
                {searchCandidates.map((place) => (
                    place.geometry?.location && (
                        <Marker 
                            key={place.place_id} 
                            position={place.geometry.location} 
                            icon={{ url: "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png" }}
                            onClick={() => {
                                setSelectedLocation({
                                    lat: place.geometry!.location!.lat(),
                                    lng: place.geometry!.location!.lng(),
                                    name: place.name || "搜尋結果",
                                    address: place.formatted_address || "",
                                    placeId: place.place_id,
                                    rating: place.rating,
                                    website: place.website
                                });
                            }}
                        />
                    )
                ))}

                <Polyline path={polylinePath} options={{ strokeColor: "#0d9488", strokeOpacity: 0.8, strokeWeight: 4 }} />
                
                {selectedLocation && (
                    <InfoWindow position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }} onCloseClick={() => { setSelectedLocation(null); setEditingSpotLocationId(null); }} options={{ headerDisabled: true }}>
                        <div className="p-0 min-w-[200px]">
                            <h3 className="font-bold text-gray-800 mb-1">{selectedLocation.name}</h3>
                            <p className="text-xs text-gray-500 mb-2">{selectedLocation.address}</p>
                            {selectedLocation.rating && <div className="text-xs text-yellow-500 mb-2">★ {selectedLocation.rating}</div>}
                            
                            {selectedLocation.existingSpotId ? (
                                <button 
                                    onClick={() => {
                                        removeSpot(selectedLocation.existingSpotId!);
                                        setSelectedLocation(null);
                                    }}
                                    className="w-full bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1"
                                >
                                    <Trash2 size={14}/> 刪除此景點
                                </button>
                            ) : (
                                <button 
                                    onClick={() => { 
                                        if (editingSpotLocationId) {
                                            updateSpot(editingSpotLocationId, { 
                                                name: selectedLocation.name, 
                                                location: { lat: selectedLocation.lat, lng: selectedLocation.lng }, 
                                                address: selectedLocation.address, 
                                                website: selectedLocation.website, 
                                                rating: selectedLocation.rating 
                                            });
                                            setEditingSpotLocationId(null);
                                            setMobileView('list');
                                        } else {
                                            addSpot({ name: selectedLocation.name, location: { lat: selectedLocation.lat, lng: selectedLocation.lng }, address: selectedLocation.address, website: selectedLocation.website, rating: selectedLocation.rating }); 
                                            setMobileView('list');
                                        }
                                        setSelectedLocation(null); 
                                        setSearchCandidates([]);
                                        setRightPanelMode('itinerary');
                                    }}
                                    className={`w-full text-white text-sm font-bold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1 ${editingSpotLocationId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-teal-600 hover:bg-teal-700'}`}
                                >
                                    {editingSpotLocationId ? <><CheckCircle2 size={14}/> 更新此景點位置</> : <><Plus size={14}/> 加入行程</>}
                                </button>
                            )}
                        </div>
                    </InfoWindow>
                )}
            </GoogleMap>
          </>
        )}
      </div>

      <div className="hidden md:flex w-2 bg-gray-100 hover:bg-teal-400 cursor-col-resize items-center justify-center z-50 transition-colors order-1 md:order-1 relative group" onMouseDown={startResizing} onDoubleClick={() => setLeftWidth(60)}>
          <div className="h-8 w-[2px] bg-gray-300 rounded-full group-hover:bg-white transition-colors" />
      </div>

      {/* ✨ Right Panel (Itinerary) */}
      <div style={{ width: window.innerWidth >= 768 ? `${100 - leftWidth}%` : '100%' }} className={`${mobileView === 'map' ? 'hidden md:flex' : 'flex'} h-full flex-col bg-[#f0f2f5] order-1 md:order-2 z-20 shadow-xl overflow-hidden relative`}>
        
        {/* Header (Teal) */}
        <div className="bg-teal-700 text-white px-4 py-3 shadow-md z-10 shrink-0">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-teal-600 rounded-lg transition-colors"><Menu size={20} /></button>
                    <div className="flex-1 min-w-0">
                        <input 
                            value={tripName} 
                            onChange={(e) => updateTripInfo({ name: e.target.value })} 
                            className="bg-transparent text-lg font-bold placeholder-teal-300 outline-none w-full border-b border-transparent focus:border-teal-400 transition-colors truncate"
                            placeholder="行程名稱..."
                        />
                        {/* ✨ 4. 日期選取器優化：包覆整個日期顯示區域，確保隨時可點選 */}
                        <div className="flex items-center gap-1 text-[10px] text-teal-200 mt-0.5 cursor-pointer hover:text-white group relative w-fit">
                            <CalendarIcon size={10}/>
                            <span>{dateRangeString}</span>
                            <input type="date" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={startDate} onChange={(e) => updateTripInfo({ startDate: e.target.value })}/>
                        </div>
                    </div>
                </div>
                <div className="flex gap-1 shrink-0">
                    <button 
                        onClick={() => setRightPanelMode('itinerary')}
                        className={`p-2 rounded-lg transition-colors ${rightPanelMode === 'itinerary' ? 'bg-teal-900 text-white' : 'bg-teal-800/50 text-teal-100 hover:bg-teal-600'}`} 
                        title="行程"
                    >
                        <List size={16} />
                    </button>
                    <button 
                        onClick={() => setRightPanelMode('translate')}
                        className={`p-2 rounded-lg transition-colors ${rightPanelMode === 'translate' ? 'bg-teal-900 text-white' : 'bg-teal-800/50 text-teal-100 hover:bg-teal-600'}`}
                        title="翻譯"
                    >
                        <Languages size={16} />
                    </button>
                    <button 
                        onClick={() => window.open('https://www.google.com/maps', '_blank')}
                        className="p-2 bg-teal-800/50 text-teal-100 rounded-lg hover:bg-teal-600 transition-colors" 
                        title="開啟 Google 地圖"
                    >
                        <MapIcon size={16} />
                    </button>
                    <button 
                        onClick={() => setRightPanelMode('budget')}
                        className={`p-2 rounded-lg transition-colors ${rightPanelMode === 'budget' ? 'bg-teal-900 text-white' : 'bg-teal-800/50 text-teal-100 hover:bg-teal-600'}`}
                        title="預算"
                    >
                        <Wallet size={16} />
                    </button>
                    <button className="p-2 bg-teal-800/50 text-teal-100 rounded-lg hover:bg-teal-600 transition-colors" title="設定"><Settings size={16} /></button>
                </div>
            </div>
            
            {rightPanelMode === 'itinerary' && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                        <SortableContext items={days.map(d => d.id)} strategy={horizontalListSortingStrategy}>
                            {days.map((day, index) => (
                                <SortableDayTab 
                                    key={day.id} day={day} index={index} 
                                    isActive={currentDayIndex === index} 
                                    onClick={() => setCurrentDayIndex(index)}
                                    displayDate={formatDate(startDate, index).date + '/' + formatDate(startDate, index).day}
                                    showDelete={days.length > 1}
                                    onDelete={() => deleteDay(index)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                    <button onClick={addDay} className="w-[60px] h-[60px] rounded-xl flex flex-col items-center justify-center bg-teal-800/30 text-teal-200 border-2 border-dashed border-teal-500/50 hover:bg-teal-600 hover:text-white transition-all shrink-0"><Plus size={20} /></button>
                </div>
            )}
        </div>

        {/* 右側內容區塊 */}
        <div className="flex-1 overflow-y-auto bg-[#f0f2f5] relative">
            
            {rightPanelMode === 'itinerary' && (
                <>
                    <div className="px-4 py-3 shrink-0">
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex justify-between items-center h-[72px]">
                            <div className="flex items-center gap-4">
                                <div className="text-center min-w-[50px]">
                                    <div className="text-sm font-bold text-gray-800">{dateObj.month}/{dateObj.date}</div>
                                    <div className="text-xs font-bold text-gray-400">({dateObj.day})</div>
                                </div>
                                <div className="h-8 w-[1px] bg-gray-100"></div>
                                <div>
                                    <div className="text-[10px] font-bold text-gray-400 mb-0.5">當日定位</div>
                                    <div className="flex items-center gap-1 text-gray-700 font-bold group text-sm">
                                        {isLoaded && (
                                            <DayLocationInput 
                                                value={displayedLocationName}
                                                placeholder="輸入區域..."
                                                onChange={(val: string) => updateDayInfo(currentDayIndex, { customLocation: val })}
                                                onLocationSelect={(lat: number, lng: number, name: string) => {
                                                    updateDayInfo(currentDayIndex, { customLocation: name, customLat: lat, customLng: lng });
                                                }}
                                            />
                                        )}
                                        <Edit3 size={12} className="text-gray-300 group-hover:text-teal-500"/>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end justify-center">
                                {weatherLoading ? <Loader2 className="animate-spin text-gray-300" size={16}/> : weather ? (
                                    <>
                                        {weather.icon}
                                        <div className="text-xs font-bold text-gray-600 mt-1">{weather.tempRange}</div>
                                    </>
                                ) : <div className="text-xs text-gray-300">無資料</div>}
                            </div>
                        </div>
                    </div>

                    <div className="px-4 pb-4">
                        {currentDayIndex === 0 && (
                            <div className="mb-2"><FlightCard type="outbound" flight={outbound} onUpdate={(info: any) => updateFlight('outbound', info)} /></div>
                        )}
                        
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={currentSpots} strategy={verticalListSortingStrategy}>
                                {currentSpots.map((spot, index) => (
                                    <SpotCard 
                                        key={spot.id}
                                        spot={spot} index={index} 
                                        updateSpot={updateSpot} 
                                        removeSpot={removeSpot} 
                                        savedCategories={savedCategories} 
                                        addCategory={addCategory}
                                        removeCategory={removeCategory}
                                        setPickingLocation={(id: string) => {
                                            setPickingLocationForSpotId(id);
                                            setMobileView('map');
                                        }}
                                        onAutoLocate={handleAutoLocate}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        <button 
                            onClick={addEmptySpot}
                            className="w-full py-3 mb-8 rounded-xl border-2 border-dashed border-teal-200 text-teal-600 font-bold flex items-center justify-center gap-2 hover:bg-teal-50 hover:border-teal-400 transition-all text-sm"
                        >
                            <Plus size={16} /> 新增行程
                        </button>

                        {currentDayIndex === days.length - 1 && (
                            <div className="mb-4"><FlightCard type="inbound" flight={inbound} onUpdate={(info: any) => updateFlight('inbound', info)} /></div>
                        )}
                    </div>
                </>
            )}

            {rightPanelMode === 'translate' && <TranslateView />}

            {rightPanelMode === 'budget' && <BudgetView />}

        </div>
      </div>
    </div>
  );
}