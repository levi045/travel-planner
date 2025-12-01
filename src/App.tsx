import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, Polyline, Autocomplete, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Navigation, ExternalLink, MapPin, Calendar as CalendarIcon, Search, Plus, Trash2, Sun, CloudRain, CloudSun, Loader2, Layout, FolderOpen, FilePlus, X, Menu, CloudFog, CloudLightning, Snowflake, Plane, PlaneTakeoff, PlaneLanding, Wand2, ChevronDown, ChevronUp, Link as LinkIcon, Tag, Star, Edit3, Download, Upload, Map, List} from 'lucide-react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// --- 0. 設定與常數 ---
const LIBRARIES: ("places")[] = ["places"];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";; 
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
  isExpanded?: boolean; 
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
  removeSpot: (spotId: string) => void;
  reorderSpots: (activeId: string, overId: string) => void;
  
  updateSpot: (id: string, info: Partial<Spot>) => void;
  toggleSpotExpand: (id: string) => void;
  addCategory: (category: string) => void;
  
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
          { id: '1', name: '淺草寺 (雷門)', category: '神社/寺廟', startTime: '10:00', endTime: '12:00', location: { lat: 35.7147, lng: 139.7967 }, website: 'https://www.senso-ji.jp/', isExpanded: false, rating: 4.7 },
          { id: '2', name: '晴空塔敘敘苑', category: '美食餐廳', startTime: '14:00', endTime: '16:00', location: { lat: 35.7100, lng: 139.8107 }, note: '記得要訂位，靠窗位置風景最好！', isExpanded: false, rating: 4.5 },
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
          
          const newSpot: Spot = { 
              ...spotData, 
              id: generateId(), 
              category: '觀光景點', 
              startTime: '', 
              endTime: '',
              isExpanded: false
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

      toggleSpotExpand: (id) => set((state) => ({
        trips: state.trips.map(t => {
            if (t.id !== state.activeTripId) return t;
            const currentDay = t.days[t.currentDayIndex];
            const newDays = [...t.days];
            newDays[t.currentDayIndex] = {
                ...currentDay,
                spots: currentDay.spots.map(s => s.id === id ? { ...s, isExpanded: !s.isExpanded } : s)
            };
            return { ...t, days: newDays };
        })
      })),

      addCategory: (category) => set((state) => {
          if (state.savedCategories.includes(category)) return state;
          return { savedCategories: [...state.savedCategories, category] };
      }),

      importData: (newTrips) => set(() => ({
          trips: newTrips,
          activeTripId: newTrips.length > 0 ? newTrips[0].id : INITIAL_TRIP_ID
      }))
    }),
    { name: 'travel-planner-storage-v19' } 
  )
);

// --- 2. API 與 輔助功能 ---

const fetchFlightData = async (flightNo: string) => {
    if (!flightNo) return null;
    const cleanNo = flightNo.trim().toUpperCase();
    try {
        if (FLIGHT_API_KEY && FLIGHT_API_KEY !== "YOUR_AVIATIONSTACK_KEY") {
            const res = await fetch(`http://api.aviationstack.com/v1/flights?access_key=${FLIGHT_API_KEY}&flight_iata=${cleanNo}`);
            const data = await res.json();
            if (data && data.data && data.data.length > 0) {
                const flight = data.data[0];
                return {
                    depTime: flight.departure.scheduled ? flight.departure.scheduled.substring(11, 16) : '',
                    arrTime: flight.arrival.scheduled ? flight.arrival.scheduled.substring(11, 16) : '',
                    depAirport: flight.departure.iata || '',
                    arrAirport: flight.arrival.iata || ''
                };
            }
        }
    } catch (e) {
        console.warn("Real API call failed", e);
    }
    return new Promise<{depTime: string, arrTime: string, depAirport: string, arrAirport: string} | null>((resolve) => {
        setTimeout(() => {
            if (cleanNo.includes('BR')) resolve({ depTime: '08:50', arrTime: '13:15', depAirport: 'TPE T2', arrAirport: 'NRT T1' });
            else if (cleanNo.includes('JX')) resolve({ depTime: '10:30', arrTime: '14:45', depAirport: 'TPE T1', arrAirport: 'KIX T1' });
            else if (cleanNo.includes('CI')) resolve({ depTime: '09:00', arrTime: '12:50', depAirport: 'TSA', arrAirport: 'HND T3' });
            else resolve({ depTime: '10:00', arrTime: '14:00', depAirport: 'TPE', arrAirport: 'NRT' });
        }, 600);
    });
};

const getGoogleMapsLink = (origin: Spot, dest: Spot) => {
  const baseUrl = "https://www.google.com/maps/dir/?api=1";
  const originStr = `${origin.location.lat},${origin.location.lng}`;
  const destStr = `${dest.location.lat},${dest.location.lng}`;
  return `${baseUrl}&origin=${originStr}&destination=${destStr}&travelmode=transit`;
};

const formatDate = (startDateStr: string, dayOffset: number) => {
  if (!startDateStr) return "選擇日期";
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) return "無效日期"; 
  date.setDate(date.getDate() + dayOffset);
  return date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' });
};

const getCategoryStyle = (category: string) => {
    const map: Record<string, string> = {
        '觀光景點': 'border-red-400 text-red-600 bg-red-50',
        '美食餐廳': 'border-orange-400 text-orange-600 bg-orange-50',
        '購物行程': 'border-yellow-400 text-yellow-600 bg-yellow-50',
        '咖啡廳': 'border-amber-400 text-amber-600 bg-amber-50',
        '神社/寺廟': 'border-stone-400 text-stone-600 bg-stone-50',
        '博物館/美術館': 'border-purple-400 text-purple-600 bg-purple-50',
        '公園/自然': 'border-green-400 text-green-600 bg-green-50',
        '居酒屋/酒吧': 'border-indigo-400 text-indigo-600 bg-indigo-50',
        '甜點/下午茶': 'border-pink-400 text-pink-600 bg-pink-50',
        '藥妝店': 'border-blue-400 text-blue-600 bg-blue-50',
        '飯店/住宿': 'border-slate-400 text-slate-600 bg-slate-50',
        '交通/車站': 'border-sky-400 text-sky-600 bg-sky-50',
    };
    return map[category] || 'border-gray-400 text-gray-600 bg-gray-50';
};

const useWeather = (lat: number, lng: number, dateStr: string, dayOffset: number) => {
    const [weather, setWeather] = useState<{ icon: React.ReactNode; text: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [autoLocationName, setAutoLocationName] = useState<string>("");

    useEffect(() => {
        const fetchWeather = async () => {
            if (!lat || !lng) return;
            setLoading(true);
            try {
                const targetDate = new Date(dateStr);
                targetDate.setDate(targetDate.getDate() + dayOffset);
                const targetDateIso = targetDate.toISOString().split('T')[0];
                const today = new Date();
                const diffTime = targetDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                const isForecastAvailable = diffDays >= 0 && diffDays <= 14;
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto${isForecastAvailable ? `&start_date=${targetDateIso}&end_date=${targetDateIso}` : ''}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.daily && data.daily.weathercode && data.daily.weathercode.length > 0) {
                    const code = data.daily.weathercode[0];
                    const min = Math.round(data.daily.temperature_2m_min[0]);
                    const max = Math.round(data.daily.temperature_2m_max[0]);
                    let text = "晴朗";
                    let icon = <Sun size={18} className="text-orange-500" />;
                    if (code > 0) {
                        if (code <= 3) { text="多雲"; icon=<CloudSun size={18} className="text-yellow-500"/>; }
                        else if (code <= 48) { text="霧"; icon=<CloudFog size={18} className="text-gray-400"/>; }
                        else if (code <= 67) { text="雨"; icon=<CloudRain size={18} className="text-blue-400"/>; }
                        else if (code <= 77) { text="雪"; icon=<Snowflake size={18} className="text-blue-200"/>; }
                        else if (code >= 95) { text="雷雨"; icon=<CloudLightning size={18} className="text-purple-500"/>; }
                        else { text="陰"; icon=<CloudSun size={18} className="text-gray-500"/>; }
                    }
                    setWeather({ icon, text: `${min}~${max}°C ${text}` });
                } else {
                     setWeather({ icon: <CloudSun size={18}/>, text: "暫無資料" });
                }
            } catch (e) {
                setWeather({ icon: <CloudSun size={18}/>, text: "讀取失敗" });
            } finally {
                setLoading(false);
            }
        };
        fetchWeather();
    }, [lat, lng, dateStr, dayOffset]);

    useEffect(() => {
        if (!lat || !lng) return;
        if (!window.google || !window.google.maps || !window.google.maps.Geocoder) return;

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng }, language: 'zh-TW' }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                const components = results[0].address_components;
                const ward = components.find(c => c.types.includes('sublocality_level_1'))?.long_name;
                const city = components.find(c => c.types.includes('locality'))?.long_name;
                const prefecture = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
                const foundName = ward || city || prefecture || "該地區";
                setAutoLocationName(foundName);
            }
        });
    }, [lat, lng]); 

    return { weather, loading, autoLocationName };
};

// --- 3. UI 元件 ---

const SmartTimeInput = ({ value, onChange, placeholder, className }: { value: string, onChange: (val: string) => void, placeholder?: string, className?: string }) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const raw = e.currentTarget.value.replace(/\D/g, '');
            if (!raw) return;
            const numVal = parseInt(raw);
            if (numVal >= 2400) { onChange("23:59"); e.currentTarget.blur(); return; }
            let hh = 0, mm = 0;
            if (raw.length <= 2) { hh = parseInt(raw); } 
            else if (raw.length === 3) { hh = parseInt(raw.substring(0, 1)); mm = parseInt(raw.substring(1)); }
            else { hh = parseInt(raw.substring(0, 2)); mm = parseInt(raw.substring(2, 4)); }
            if (hh > 23) hh = 23; if (mm > 59) mm = 59;
            const formatted = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
            onChange(formatted);
            e.currentTarget.blur();
        }
    };
    const defaultClass = "text-[10px] bg-gray-50 border border-transparent hover:border-gray-200 rounded px-1 w-full text-center text-gray-600 focus:border-blue-400 outline-none font-medium transition-all";
    return ( <input type="text" placeholder={placeholder} className={className || defaultClass} value={value || ''} onChange={(e) => onChange(e.target.value)} onKeyDown={handleKeyDown} /> );
};

const DestinationInput = ({ value, onChange, onLocationSelect }: { value: string, onChange: (val: string) => void, onLocationSelect: (lat: number, lng: number) => void }) => {
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const onLoad = (autocomplete: google.maps.places.Autocomplete) => { autocompleteRef.current = autocomplete; };
    const onPlaceChanged = () => {
        if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (!place || !place.geometry) return; // ✨ Fixed: Safety check
            if (place.name) onChange(place.name);
            if (place.geometry.location) {
                onLocationSelect(place.geometry.location.lat(), place.geometry.location.lng());
            }
        }
    };
    return (
        <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged} types={['(cities)']}>
            <input value={value} onChange={(e) => onChange(e.target.value)} className="text-sm font-bold text-gray-700 w-full outline-none bg-transparent placeholder-gray-400" placeholder="搜尋目的地 (例如: 大阪)..." />
        </Autocomplete>
    );
};

const DayLocationInput = ({ 
    value, 
    placeholder, 
    onChange, 
    onLocationSelect 
}: { 
    value: string, 
    placeholder: string,
    onChange: (val: string) => void, 
    onLocationSelect: (lat?: number, lng?: number, name?: string) => void 
}) => {
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    
    const onLoad = (autocomplete: google.maps.places.Autocomplete) => { 
        autocompleteRef.current = autocomplete; 
    };
    
    const onPlaceChanged = () => {
        if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (!place || !place.geometry || !place.geometry.location) return; // ✨ Fixed: Safety check
            
            onLocationSelect(
                place.geometry.location.lat(), 
                place.geometry.location.lng(),
                place.name || ""
            );
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(val);
        if (val === '') {
            onLocationSelect(undefined, undefined, undefined);
        }
    };

    return (
        <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged} types={['(regions)']}>
             <input 
                className="bg-transparent outline-none w-auto min-w-[60px] max-w-[120px] placeholder-gray-400 text-gray-600 font-medium" 
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
            />
        </Autocomplete>
    );
};

const CustomInfoWindow = ({ 
    title, 
    address, 
    rating, 
    category, 
    buttonText, 
    buttonColorClass, 
    onClose, 
    onAction, 
    actionIcon 
}: { 
    title: string;
    address: string;
    rating?: number;
    category?: string;
    buttonText: string;
    buttonColorClass: string;
    onClose: () => void;
    onAction: () => void;
    actionIcon: React.ReactNode;
}) => {
    const categoryStyle = category ? getCategoryStyle(category) : 'border-gray-400 text-gray-600 bg-gray-50';
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                onAction();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onAction]);

    return (
        <div className="p-0 min-w-[220px] max-w-[260px]">
            <div className="flex justify-between items-start mb-1 gap-2">
                <h3 className="font-bold text-gray-800 text-base leading-tight break-words flex-1 pt-0.5">{title}</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-0.5 rounded transition-colors shrink-0" title="關閉"><X size={16} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-2 leading-relaxed">{address}</p>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                {rating && (<div className="flex items-center gap-1 text-orange-500 text-xs font-bold bg-orange-50 px-2 py-0.5 rounded-full"><Star size={10} fill="currentColor"/><span>{rating}</span></div>)}
                {category && (<div className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${categoryStyle}`}><Tag size={10} /> {category}</div>)}
            </div>
            <button onClick={onAction} className={`w-full py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 ${buttonColorClass}`}>{actionIcon} {buttonText}</button>
        </div>
    );
};

const SortableDayTab = ({ day, index, isActive, onClick, onDelete, showDelete }: { day: Day, index: number, isActive: boolean, onClick: () => void, onDelete: () => void, showDelete: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: day.id });
    
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group flex-shrink-0 touch-none">
            <button 
                onClick={onClick} 
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer select-none ${isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
                第 {index + 1} 天
            </button>
            {showDelete && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                    <Trash2 size={10} />
                </button>
            )}
        </div>
    );
};

const FlightCard = ({ type, flight, onUpdate }: { type: 'outbound' | 'inbound', flight: FlightInfo, onUpdate: (info: Partial<FlightInfo>) => void }) => {
    const [isLoading, setIsLoading] = useState(false);
    const handleAutoImport = async () => {
        if (!flight.flightNo) return;
        setIsLoading(true);
        const data = await fetchFlightData(flight.flightNo);
        setIsLoading(false);
        if (data) onUpdate(data);
    };
    return (
        <div className={`mb-3 relative rounded-xl border p-4 shadow-sm transition-all ${type === 'outbound' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full text-white shrink-0 ${type === 'outbound' ? 'bg-blue-500' : 'bg-orange-500'}`}>{type === 'outbound' ? <PlaneTakeoff size={20} /> : <PlaneLanding size={20} />}</div>
                <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-3 flex items-center gap-1">
                        <div className="flex flex-col w-full">
                            <label className="text-[10px] uppercase font-bold text-gray-400">航班代號</label>
                            <div className="flex items-center border-b border-gray-300 focus-within:border-blue-500">
                                <input className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none uppercase placeholder-gray-300" placeholder="BR198" value={flight.flightNo} onChange={(e) => onUpdate({ flightNo: e.target.value })}/>
                                <button onClick={handleAutoImport} disabled={isLoading} className="p-1 hover:bg-gray-200 rounded-full text-blue-500 transition-colors">{isLoading ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12} />}</button>
                            </div>
                        </div>
                    </div>
                    <div className="col-span-9 flex items-center justify-between bg-white/50 p-2 rounded-lg border border-white/60">
                         <div className="flex flex-col items-center min-w-[60px]"><SmartTimeInput className="bg-transparent text-lg font-bold text-gray-800 outline-none w-full text-center" value={flight.depTime} onChange={(val)=>onUpdate({depTime: val})} /><input className="bg-transparent text-[10px] text-gray-500 font-bold uppercase w-full text-center outline-none" value={flight.depAirport} placeholder="TPE" onChange={(e)=>onUpdate({depAirport: e.target.value})} /></div>
                         <div className="flex flex-col items-center px-2 text-gray-400"><Plane size={14} className="rotate-90 mb-1" /><div className="h-[1px] w-8 bg-gray-300"></div></div>
                         <div className="flex flex-col items-center min-w-[60px]"><SmartTimeInput className="bg-transparent text-lg font-bold text-gray-800 outline-none w-full text-center" value={flight.arrTime} onChange={(val)=>onUpdate({arrTime: val})} /><input className="bg-transparent text-[10px] text-gray-500 font-bold uppercase w-full text-center outline-none" value={flight.arrAirport} placeholder="NRT" onChange={(e)=>onUpdate({arrAirport: e.target.value})} /></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SpotCard = ({ spot, index, isLast, updateSpot, toggleSpotExpand, removeSpot, savedCategories, addCategory }: { 
    spot: Spot; 
    index: number; 
    isLast: boolean; 
    updateSpot: (id: string, info: Partial<Spot>) => void;
    toggleSpotExpand: (id: string) => void;
    removeSpot: (id: string) => void;
    savedCategories: string[];
    addCategory: (cat: string) => void;
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: spot.id });
    
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchCat, setSearchCat] = useState("");
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsCategoryOpen(false);
            }
        };
        if (isCategoryOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            if (searchInputRef.current) searchInputRef.current.focus();
            setActiveIndex(0);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCategoryOpen]);

    const style = { 
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 100 : (isCategoryOpen ? 50 : 'auto'),
        position: 'relative' as const 
    };

    const categoryStyle = getCategoryStyle(spot.category || 'other');
    const filteredCats = savedCategories.filter(c => c.toLowerCase().includes(searchCat.toLowerCase()));

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isCategoryOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % filteredCats.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + filteredCats.length) % filteredCats.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCats.length > 0) {
                const selected = filteredCats[activeIndex];
                updateSpot(spot.id, { category: selected });
                setIsCategoryOpen(false);
                setSearchCat("");
            } else if (searchCat && !savedCategories.includes(searchCat)) {
                addCategory(searchCat);
                updateSpot(spot.id, { category: searchCat });
                setIsCategoryOpen(false);
                setSearchCat("");
            }
        } else if (e.key === 'Escape') {
            setIsCategoryOpen(false);
        }
    };

    const handleUrlClick = (e: React.MouseEvent, url?: string) => {
        if (e.ctrlKey && url) {
            e.preventDefault();
            window.open(url, '_blank');
        }
    };

    return (
      <div ref={setNodeRef} style={style} className="relative mb-2 group touch-none">
        <div className={`bg-white rounded-xl shadow-sm border transition-all ${spot.isExpanded ? 'ring-2 ring-blue-100 border-blue-300' : 'border-gray-100'}`}>
            
            <div className="p-3 pr-2 flex items-center gap-2">
                <div {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 p-1 hover:bg-gray-100 rounded-lg shrink-0">
                    <GripVertical size={18} />
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); toggleSpotExpand(spot.id); }} 
                    className={`p-1 rounded-md transition-colors ${spot.isExpanded ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                >
                    {spot.isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>

                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold text-xs shrink-0">
                    {index + 1}
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col gap-1 relative">
                    <input 
                        className="font-semibold text-gray-800 text-sm bg-transparent outline-none border-b border-transparent focus:border-blue-300 w-full"
                        value={spot.name}
                        onChange={(e) => updateSpot(spot.id, { name: e.target.value })}
                        placeholder="景點名稱"
                    />
                    
                    <div className="relative" ref={popoverRef}>
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setIsCategoryOpen(!isCategoryOpen); 
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${categoryStyle} w-fit flex items-center gap-1 transition-all hover:brightness-95 whitespace-nowrap`}
                        >
                            <Tag size={10} /> {spot.category}
                        </button>
                        
                        {isCategoryOpen && (
                            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 shadow-xl rounded-lg z-[999] p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-150">
                                <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-1 px-1">
                                    <Search size={14} className="text-gray-400"/>
                                    <input 
                                        ref={searchInputRef}
                                        className="w-full text-sm outline-none text-gray-700 placeholder-gray-400 font-sans"
                                        placeholder="搜尋或建立..."
                                        value={searchCat}
                                        onChange={(e) => { setSearchCat(e.target.value); setActiveIndex(0); }}
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>
                                <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
                                    {searchCat && !savedCategories.includes(searchCat) && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addCategory(searchCat);
                                                updateSpot(spot.id, { category: searchCat });
                                                setIsCategoryOpen(false);
                                                setSearchCat("");
                                            }}
                                            className="text-left text-sm leading-relaxed px-3 py-2 hover:bg-blue-50 text-blue-600 rounded-md flex items-center gap-2 font-bold transition-colors"
                                        >
                                            <Plus size={14}/> 建立 "{searchCat}"
                                        </button>
                                    )}
                                    {filteredCats.map((cat, idx) => (
                                        <button 
                                            key={cat} 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateSpot(spot.id, { category: cat });
                                                setIsCategoryOpen(false);
                                                setSearchCat("");
                                            }}
                                            className={`text-left text-sm leading-relaxed px-3 py-2 rounded-md truncate transition-colors font-sans ${idx === activeIndex ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-700'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-0.5 px-1 border-l border-gray-100 min-w-[50px]">
                    <SmartTimeInput value={spot.startTime || ''} onChange={(val) => updateSpot(spot.id, { startTime: val })} />
                    <div className="h-2 w-[1px] bg-gray-300 my-0.5"></div>
                    <SmartTimeInput value={spot.endTime || ''} onChange={(val) => updateSpot(spot.id, { endTime: val })} />
                </div>

                <button onClick={() => removeSpot(spot.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all shrink-0"><Trash2 size={14} /></button>
            </div>

            {spot.isExpanded && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-50 bg-gray-50/50 flex flex-col gap-2 rounded-b-xl">
                    <div className="flex items-center gap-2 mt-2 bg-white border border-gray-200 rounded-md px-2 py-1.5">
                        <LinkIcon size={12} className="text-gray-400 shrink-0" />
                        <input 
                            className="text-xs text-blue-600 w-full outline-none bg-transparent placeholder-gray-400 cursor-pointer" 
                            placeholder="貼上網址 (例如 Google Maps 分享連結)... (Ctrl+點擊開啟)" 
                            value={spot.website || ''} 
                            onChange={(e) => updateSpot(spot.id, { website: e.target.value })}
                            onClick={(e) => handleUrlClick(e, spot.website)} 
                            title="按住 Ctrl 點擊可直接開啟網頁"
                        />
                        {spot.website && (<a href={spot.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500"><ExternalLink size={12} /></a>)}
                    </div>
                    <textarea className="w-full text-xs text-gray-600 border border-gray-200 rounded-md p-2 outline-none focus:border-blue-300 min-h-[60px] resize-none bg-white" placeholder="詳細備註 (例如：要點海鮮丼、不要加蔥)..." value={spot.note || ''} onChange={(e) => updateSpot(spot.id, { note: e.target.value })} />
                </div>
            )}
        </div>
        {!isLast && <div className="absolute left-7 bottom-[-15px] h-[15px] w-0.5 bg-gray-200 z-0"/>}
      </div>
    );
};

const HeaderControls = ({ onPlacePreview, onMenuClick }: { onPlacePreview: (place: google.maps.places.PlaceResult) => void, onMenuClick: () => void }) => {
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
    return (
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 font-sans w-full max-w-md pointer-events-none">
         <button onClick={onMenuClick} className="pointer-events-auto p-3 bg-white shadow-lg rounded-lg text-gray-600 hover:text-blue-600 transition-all flex-shrink-0"><Menu size={20} /></button>
         <div className="pointer-events-auto relative flex-1 shadow-lg rounded-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-20"><Search size={16} className="text-gray-400" /></div>
            <Autocomplete 
                onLoad={onLoad} 
                onPlaceChanged={onPlaceChanged}
                options={{ fields: ["geometry", "name", "formatted_address", "place_id", "rating", "website"] }}
            >
                <input type="text" placeholder="搜尋地點..." className="block w-full pl-10 pr-3 py-3 rounded-lg leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400" value={inputValue} onChange={(e) => setInputValue(e.target.value)}/>
            </Autocomplete>
        </div>
      </div>
    );
};

// 請把原本的 Sidebar 元件整段換成這個
const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { trips, activeTripId, createTrip, switchTrip, deleteTrip, trips: allTrips, importData } = useStore();
    const [isLoading, setIsLoading] = useState(false);

    // ✨ 新功能：儲存到雲端 (電腦端按這個)
    const handleSaveToCloud = async () => {
        setIsLoading(true);
        try {
            // 我們把目前的 allTrips 整包存上去
            const response = await fetch('/api/save-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: allTrips }),
            });

            if (response.ok) {
                alert('☁️ 成功！行程已儲存到雲端，手機上可以看囉！');
            } else {
                const err = await response.json();
                alert('儲存失敗：' + (err.error || '未知錯誤'));
            }
        } catch (error) {
            console.error(error);
            alert('網路錯誤，無法儲存');
        } finally {
            setIsLoading(false);
        }
    };

    // ✨ 新功能：從雲端讀取 (手機端按這個)
    const handleLoadFromCloud = async () => {
        if (!confirm('確定要從雲端讀取嗎？這會覆蓋目前的進度喔！')) return;
        
        setIsLoading(true);
        try {
            const response = await fetch('/api/get-plans');
            const data = await response.json();
            
            // 檢查回傳的資料結構，取出最新的一筆
            // 根據我們之前的 API，資料是在 data.plans[0].content (或是 data.plans[0].data)
            if (data.plans && data.plans.length > 0) {
                // 這裡要對應資料庫欄位，如果是用 Neon 範例通常是 'content' 或 'data'
                // 我們做個保險，兩個都檢查
                const latestPlan = data.plans[0].content || data.plans[0].data;
                
                if (latestPlan) {
                    importData(latestPlan); // 更新 Zustand 狀態
                    alert('✨ 行程同步完成！');
                    onClose(); // 關閉側邊欄
                } else {
                    alert('讀取到的資料格式怪怪的');
                }
            } else {
                alert('雲端目前沒有存檔喔！');
            }
        } catch (error) {
            console.error(error);
            alert('讀取失敗，請檢查網路');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white">
                <h2 className="font-bold flex items-center gap-2"><FolderOpen size={20}/> 我的行程庫</h2>
                <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto h-full pb-20 flex flex-col gap-2">
                {trips.map(trip => (
                    <div key={trip.id} onClick={() => { switchTrip(trip.id); onClose(); }} className={`group p-3 rounded-lg cursor-pointer border transition-all ${activeTripId === trip.id ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                        <div className="flex justify-between items-start">
                            <h3 className={`font-bold ${activeTripId === trip.id ? 'text-blue-700' : 'text-gray-700'}`}>{trip.name}</h3>
                            {trips.length > 1 && (<button onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{trip.destination} • {trip.days.length} 天</p>
                    </div>
                ))}
                <button onClick={createTrip} className="w-full py-3 mt-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-colors font-medium"><FilePlus size={18} /> 建立新行程</button>
                
                {/* ✨ 雲端同步區塊 (取代原本的匯入匯出) */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">雲端同步</h3>
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={handleSaveToCloud} 
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-all font-bold shadow-sm disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16} />}
                            儲存到雲端
                        </button>

                        <button 
                            onClick={handleLoadFromCloud} 
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 p-3 bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-700 rounded-lg transition-all font-medium border border-gray-200 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin"/> : <Download size={16} />}
                            從雲端讀取 (手機用)
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                        電腦按「儲存」後，用手機打開網頁按「讀取」即可同步。
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- 4. 主程式 ---

export default function VacationPlanner() {
    const { 
        trips, activeTripId, savedCategories,
        setCurrentDayIndex, addDay, deleteDay,
        addSpot, removeSpot, reorderSpots, updateSpot, toggleSpotExpand, addCategory,
        updateTripInfo, updateFlight, reorderDays, updateDayInfo
    } = useStore();
    
    const activeTrip = trips.find(t => t.id === activeTripId) || trips[0];
    const { days, currentDayIndex, destination, startDate, name: tripName, outbound, inbound } = activeTrip;
  
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const mapRef = useRef<google.maps.Map | null>(null);
    
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string; address: string; placeId?: string; rating?: number; website?: string } | null>(null);
    const [selectedSpotToRemove, setSelectedSpotToRemove] = useState<Spot | null>(null);
  
    // ✨ UI 狀態與響應式邏輯
    const [leftWidth, setLeftWidth] = useState(60); 
    const [isResizing, setIsResizing] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
    const [mobileTab, setMobileTab] = useState<'map' | 'list'>('list'); // 手機版目前的模式
  
    // 監聽視窗大小，判斷是手機還是電腦
    useEffect(() => {
      const handleResize = () => setIsDesktop(window.innerWidth >= 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
  
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
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);
  
  
    const onLoadMap = React.useCallback((map: google.maps.Map) => { mapRef.current = map; }, []);
    const onUnmountMap = React.useCallback(() => { mapRef.current = null; }, []);
  
    const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: LIBRARIES, language: 'zh-TW' });
    
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), 
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
  
    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (active.id !== over?.id) reorderSpots(active.id as string, over?.id as string);
    };
  
    const handleDestinationSelect = (lat: number, lng: number) => {
        if (mapRef.current) {
            mapRef.current.panTo({ lat, lng });
            mapRef.current.setZoom(12);
        }
    };
  
    const currentDayData = days[currentDayIndex] || { spots: [] };
    const currentSpots = currentDayData.spots;
    
    const weatherLocation = useMemo(() => {
        if (currentDayData.customLat && currentDayData.customLng) {
            return { lat: currentDayData.customLat, lng: currentDayData.customLng };
        }
        if (currentSpots.length === 0) return { lat: 35.6762, lng: 139.6503 }; 
        const lats = currentSpots.map(s => s.location.lat).sort((a,b) => a-b);
        const lngs = currentSpots.map(s => s.location.lng).sort((a,b) => a-b);
        const mid = Math.floor(lats.length / 2);
        return { lat: lats[mid], lng: lngs[mid] };
    }, [currentSpots, currentDayData]);
  
    const mapCenter = useMemo(() => {
        return currentSpots.length > 0 ? currentSpots[0].location : { lat: 35.6762, lng: 139.6503 };
    }, [currentSpots]);
  
    const { weather, loading: weatherLoading, autoLocationName } = useWeather(weatherLocation.lat, weatherLocation.lng, startDate, currentDayIndex);
    const displayedLocationName = currentDayData.customLocation || autoLocationName;
  
    const onMapClick = React.useCallback((e: google.maps.MapMouseEvent) => {
      const event = e as any; 
      if (!e.latLng) return;
      setSelectedSpotToRemove(null);
      setSelectedLocation(null);
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      if (event.placeId) {
          e.stop(); 
          if (!mapRef.current) return;
          const service = new google.maps.places.PlacesService(mapRef.current);
          service.getDetails({ placeId: event.placeId, fields: ['name', 'formatted_address', 'geometry', 'rating', 'website'] }, (place, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
                  setSelectedLocation({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng(), name: place.name || "未知名稱", address: place.formatted_address || "", placeId: event.placeId, rating: place.rating, website: place.website });
              }
          });
      } else {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              let spotName = `自選地點`;
              let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              if (status === "OK" && results && results[0]) {
                  address = results[0].formatted_address;
                  const parts = address.split(' ');
                  if (parts.length > 0) spotName = parts[parts.length - 1]; 
              }
              setSelectedLocation({ lat, lng, name: spotName, address: address });
          });
      }
    }, []);
  
    const handlePlacePreview = (place: google.maps.places.PlaceResult) => {
       if (place.geometry && place.geometry.location && place.name) {
           const lat = place.geometry.location.lat();
           const lng = place.geometry.location.lng();
           if(mapRef.current) { mapRef.current.panTo({ lat, lng }); mapRef.current.setZoom(15); }
           setSelectedLocation({ lat, lng, name: place.name, address: place.formatted_address || "", placeId: place.place_id, rating: place.rating, website: place.website });
           setSelectedSpotToRemove(null);
           
           // 手機版搜尋後自動切到地圖模式
           if (!isDesktop) setMobileTab('map');
       }
    };
    
    const handleDayDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = days.findIndex(d => d.id === active.id);
            const newIndex = days.findIndex(d => d.id === over?.id);
            reorderDays(oldIndex, newIndex);
        }
    };
  
    const polylinePath = currentSpots.map(s => s.location);
    const currentDateDisplay = formatDate(startDate, currentDayIndex);
    const isFirstDay = currentDayIndex === 0;
    const isLastDay = currentDayIndex === days.length - 1;
  
    if (loadError) return <div className="p-10 text-red-500 font-bold">載入地圖失敗，請檢查 API Key 額度與權限設定。</div>;
  
    return (
      // 使用 h-[100dvh] 解決手機瀏覽器網址列遮擋問題
      <div className="flex h-[100dvh] w-full bg-gray-50 overflow-hidden flex-col md:flex-row font-sans relative select-none">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setSidebarOpen(false)} />}
        
        {/* ✨ 左側地圖區塊 */}
        {/* 在手機版：如果目前模式是 map 才顯示，且寬度 100% */}
        {/* 在電腦版：永遠顯示，寬度依照 leftWidth */}
        <div 
          style={{ width: isDesktop ? `${leftWidth}%` : '100%' }} 
          className={`${!isDesktop && mobileTab !== 'map' ? 'hidden' : 'flex'} h-full md:h-full relative order-2 md:order-1 bg-gray-200 flex-col`}
        >
          {!isLoaded ? (<div className="flex h-full w-full items-center justify-center text-gray-500 gap-2"><Loader2 className="animate-spin" /> 地圖載入中...</div>) : (
            <>
              <HeaderControls onMenuClick={() => setSidebarOpen(true)} onPlacePreview={handlePlacePreview} />
              <GoogleMap 
                  mapContainerStyle={{ width: '100%', height: '100%' }} center={mapCenter} zoom={13} 
                  options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy' }} 
                  onClick={onMapClick} onDragStart={() => setSelectedLocation(null)} onLoad={onLoadMap} onUnmount={onUnmountMap}
              >
                  {currentSpots.map((spot, index) => (
                     <Marker key={spot.id} position={spot.location} label={{ text: (index + 1).toString(), color: "white", fontWeight: "bold" }} onClick={() => { setSelectedLocation(null); setSelectedSpotToRemove(spot); }} />
                  ))}
                  <Polyline path={polylinePath} options={{ strokeColor: "#3B82F6", strokeOpacity: 0.8, strokeWeight: 4 }} />
                  
                  {selectedLocation && (
                      <InfoWindow position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }} onCloseClick={() => setSelectedLocation(null)} options={{ headerDisabled: true }}>
                          <CustomInfoWindow 
                              title={selectedLocation.name} address={selectedLocation.address} rating={selectedLocation.rating}
                              buttonText="加入行程" buttonColorClass="bg-blue-600 text-white hover:bg-blue-700" actionIcon={<Plus size={16} />}
                              onClose={() => setSelectedLocation(null)}
                              onAction={() => { 
                                  addSpot({ name: selectedLocation.name, location: { lat: selectedLocation.lat, lng: selectedLocation.lng }, address: selectedLocation.address, website: selectedLocation.website, rating: selectedLocation.rating }); 
                                  setSelectedLocation(null); 
                                  if (!isDesktop) {
                                      alert("已加入！切換到列表即可查看");
                                      setMobileTab('list');
                                  }
                              }}
                          />
                      </InfoWindow>
                  )}
  
                  {selectedSpotToRemove && (
                      <InfoWindow position={selectedSpotToRemove.location} onCloseClick={() => setSelectedSpotToRemove(null)} options={{ headerDisabled: true }}>
                          <CustomInfoWindow 
                              title={selectedSpotToRemove.name} address={selectedSpotToRemove.address || "已在行程中"} rating={selectedSpotToRemove.rating} category={selectedSpotToRemove.category}
                              buttonText="移除此景點" buttonColorClass="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" actionIcon={<Trash2 size={16} />}
                              onClose={() => setSelectedSpotToRemove(null)}
                              onAction={() => { removeSpot(selectedSpotToRemove.id); setSelectedSpotToRemove(null); }}
                          />
                      </InfoWindow>
                  )}
              </GoogleMap>
            </>
          )}
        </div>
  
        {/* 電腦版才有的分隔線 */}
        <div className="hidden md:flex w-2 bg-gray-100 hover:bg-blue-400 cursor-col-resize items-center justify-center z-50 transition-colors order-1 md:order-1 relative group" onMouseDown={startResizing} onDoubleClick={() => setLeftWidth(60)} title="點兩下重置比例">
            <div className="h-8 w-[2px] bg-gray-300 rounded-full group-hover:bg-white transition-colors" />
        </div>
  
        {/* ✨ 右側行程列表區塊 */}
        {/* 在手機版：如果目前模式是 list 才顯示，且寬度 100% */}
        <div 
          style={{ width: isDesktop ? `${100 - leftWidth}%` : '100%' }} 
          className={`${!isDesktop && mobileTab !== 'list' ? 'hidden' : 'flex'} h-full flex-col bg-white order-1 md:order-2 z-20 shadow-xl overflow-hidden`}
        >
          <div className="px-6 py-4 bg-white border-b border-gray-100 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                  {/* 手機版補上 Menu 按鈕，因為 HeaderControls 只在地圖顯示 */}
                  <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-500"><Menu size={20} /></button>
                  <Layout size={18} className="text-blue-500 hidden md:block" />
                  <input value={tripName} onChange={(e) => updateTripInfo({ name: e.target.value })} className="text-xl font-extrabold text-gray-800 w-full outline-none placeholder-gray-300 border-b border-transparent focus:border-blue-300 transition-colors" placeholder="輸入行程名稱..." />
              </div>
              {/* 其他 Input 保持原樣 */}
              <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
                      <MapPin size={16} className="text-gray-400 shrink-0" />
                      {isLoaded && (
                          <DestinationInput 
                              value={destination} 
                              onChange={(val) => updateTripInfo({ destination: val })} 
                              onLocationSelect={handleDestinationSelect}
                          />
                      )}
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg"><CalendarIcon size={16} className="text-gray-400 shrink-0" /><input type="date" value={startDate} onChange={(e) => updateTripInfo({ startDate: e.target.value })} className="text-sm text-gray-700 outline-none font-medium bg-transparent w-full" /></div>
              </div>
          </div>
  
          {/* Draggable Day Tabs */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto no-scrollbar">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                  <SortableContext items={days.map(d => d.id)} strategy={horizontalListSortingStrategy}>
                      {days.map((day, index) => (
                          <SortableDayTab 
                              key={day.id} 
                              day={day} 
                              index={index} 
                              isActive={currentDayIndex === index} 
                              onClick={() => setCurrentDayIndex(index)}
                              onDelete={() => deleteDay(index)}
                              showDelete={days.length > 1}
                          />
                      ))}
                  </SortableContext>
              </DndContext>
              <button onClick={addDay} className="p-1.5 rounded-full bg-white border border-dashed border-gray-300 hover:border-blue-500 hover:text-blue-500 transition-colors"><Plus size={16} /></button>
          </div>
  
          <div className="px-6 py-3 border-b border-gray-100 bg-white flex justify-between items-center">
               <div>
                  <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-800">第 {currentDayIndex + 1} 天行程</h2>
                      <div className="flex items-center text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full hover:bg-gray-200 transition-colors group/edit cursor-text">
                          <MapPin size={10} className="mr-1"/>
                          {isLoaded && (
                              <DayLocationInput 
                                  value={displayedLocationName}
                                  placeholder="區域 (自動偵測)"
                                  onChange={(val) => updateDayInfo(currentDayIndex, { customLocation: val })}
                                  onLocationSelect={(lat, lng, name) => {
                                      updateDayInfo(currentDayIndex, { 
                                          customLocation: name, 
                                          customLat: lat,
                                          customLng: lng
                                      });
                                  }}
                              />
                          )}
                          <Edit3 size={10} className="ml-1 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                      </div>
                  </div>
                  <div className="text-sm text-gray-500">{currentDateDisplay}</div>
               </div>
               <div className="flex flex-col items-end">
                  {weatherLoading ? (<div className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="animate-spin" size={12}/>更新氣象中</div>) : weather ? (
                      <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{weather.icon}<span className="text-sm font-semibold text-gray-700">{weather.text}</span></div>
                      </div>
                  ) : null}
               </div>
          </div>
  
          {/* 列表內容區域 - 增加 pb-24 防止手機版內容被底部按鈕擋住 */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 pb-24 md:pb-4">
            {isFirstDay && <FlightCard type="outbound" flight={outbound} onUpdate={(info) => updateFlight('outbound', info)} />}
            
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={currentSpots} strategy={verticalListSortingStrategy}>
                {currentSpots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm"><Search size={32} className="mb-2 opacity-50"/><p>在地圖上搜尋或點選來新增景點</p></div>
                ) : (
                  currentSpots.map((spot, index) => (
                      <React.Fragment key={spot.id}>
                          <SpotCard 
                              spot={spot} index={index} isLast={index === currentSpots.length - 1} 
                              updateSpot={updateSpot} toggleSpotExpand={toggleSpotExpand} removeSpot={removeSpot} 
                              savedCategories={savedCategories} addCategory={addCategory}
                          />
                          {index < currentSpots.length - 1 && (
                              <div className="flex justify-center py-2 relative z-10">
                                  <a href={getGoogleMapsLink(spot, currentSpots[index + 1])} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200 shadow-sm hover:bg-green-100 transition-colors"><Navigation size={12} /><span>交通方式</span><ExternalLink size={10} /></a>
                              </div>
                          )}
                      </React.Fragment>
                  ))
                )}
              </SortableContext>
            </DndContext>
  
            {isLastDay && <FlightCard type="inbound" flight={inbound} onUpdate={(info) => updateFlight('inbound', info)} />}
          </div>
        </div>
  
        {/* ✨ 手機版專屬：底部浮動切換按鈕 */}
        {!isDesktop && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex bg-white/90 backdrop-blur shadow-lg rounded-full p-1.5 border border-gray-200">
              <button 
                  onClick={() => setMobileTab('map')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${mobileTab === 'map' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                  <Map size={18} /> 地圖
              </button>
              <button 
                  onClick={() => setMobileTab('list')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${mobileTab === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                  <List size={18} /> 行程 ({currentSpots.length})
              </button>
          </div>
        )}
      </div>
    );
  }