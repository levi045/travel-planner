import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GoogleMap, Marker, Polyline, Autocomplete, useJsApiLoader, InfoWindow } from '@react-google-maps/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Navigation, ExternalLink, MapPin, Calendar as CalendarIcon, Search, Plus, Trash2, Sun, CloudRain, CloudSun, Loader2, Layout, FolderOpen, FilePlus, X, Menu, CloudFog, CloudLightning, Snowflake, Plane, PlaneTakeoff, PlaneLanding, Wand2, ChevronDown, ChevronUp, Link as LinkIcon, Tag, Star, Edit3, Map as MapIcon, List, CheckSquare, Check, ArrowLeft, Hotel, Copy, RefreshCcw, FolderHeart, Heart, Eye, EyeOff, Flag, Utensils, Coffee, ShoppingBag } from 'lucide-react';
import { create } from 'zustand';
// 注意：我們移除了 'zustand/middleware' 的 persist，因為要改用雲端同步

// --- 0. 設定與常數 ---
const LIBRARIES: ("places")[] = ["places"];
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
const LOCATION_TOLERANCE = 0.0001;
const AUTO_SAVE_DELAY = 2000;
const DEFAULT_MAP_CENTER = { lat: 35.6762, lng: 139.6503 };
const DEFAULT_ZOOM = 13;

const generateId = () => Math.random().toString(36).substring(2, 11);

const DEFAULT_CATEGORIES = [
    '觀光景點', '美食餐廳', '購物行程', '咖啡廳', 
    '神社/寺廟', '博物館/美術館', '公園/自然', 
    '居酒屋/酒吧', '甜點/下午茶', '伴手禮', 
    '藥妝店', '飯店/住宿', '交通/車站', 
    '主題樂園', '便利商店', '休息點'
];

const ICONS = [
    { id: 'star', icon: <Star size={14}/>, label: '星星' },
    { id: 'heart', icon: <Heart size={14}/>, label: '愛心' },
    { id: 'flag', icon: <Flag size={14}/>, label: '旗幟' },
    { id: 'food', icon: <Utensils size={14}/>, label: '美食' },
    { id: 'coffee', icon: <Coffee size={14}/>, label: '咖啡' },
    { id: 'shop', icon: <ShoppingBag size={14}/>, label: '購物' },
];

const DEFAULT_CHECKLIST_GROUPS = [
    { title: "重要證件與財物", items: ['手機', '兵役核准單', '護照', '現金 (日幣/台幣)', '錢包', '信用卡'] },
    { title: "3C 電子產品", items: ['耳機', '行動電源', '筆電或平板', '充電器/線', 'eSIM / 網卡', '相機'] },
    { title: "個人護理與衣物", items: ['指甲剪', '刮鬍刀', '保健食品', '牙套', '隱形眼鏡', '保養品', '牙刷牙膏', '換洗衣物'] },
    { title: "醫藥與雜物", items: ['個人藥品', '護唇膏', '濕紙巾', '口罩', '眼罩', '衛生紙', '塑膠袋/購物袋'] }
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

interface ChecklistItem { id: string; text: string; isChecked: boolean; }
interface ChecklistGroup { id: string; title: string; items: ChecklistItem[]; }

interface Collection {
    id: string;
    name: string;
    color: string;
    icon: string;
    isVisible: boolean;
    spots: Spot[];
}

interface Accommodation {
    name: string;
    location: { lat: number; lng: number };
    address?: string;
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
  checklistGroups: ChecklistGroup[];
  accommodation?: Accommodation;
}

interface ItineraryStore {
  trips: Trip[];
  activeTripId: string;
  savedCategories: string[];
  collections: Collection[]; 
  viewMode: 'day' | 'checklist' | 'collections'; 
  
  // ✨ 新增：雲端同步相關狀態與方法
  currentProfile: 'admin' | 'visitor' | null;
  isSyncing: boolean;
  setProfileAndLoad: (profile: 'admin' | 'visitor') => Promise<void>;
  saveToCloud: () => Promise<void>;

  setViewMode: (mode: 'day' | 'checklist' | 'collections') => void;

  // Trip Management
  createTrip: () => void;
  switchTrip: (id: string) => void;
  deleteTrip: (id: string) => void;
  duplicateTrip: (id: string) => void;
  updateTripInfo: (info: Partial<Trip>) => void;
  
  // 住宿
  setAccommodation: (place: Accommodation | undefined) => void;

  updateFlight: (type: 'outbound' | 'inbound', info: Partial<FlightInfo>) => void;

  // Day Management
  setCurrentDayIndex: (index: number) => void;
  addDay: () => void;
  duplicateDay: (index: number) => void;
  deleteDay: (index: number) => void;
  reorderDays: (oldIndex: number, newIndex: number) => void; 
  updateDayInfo: (dayIndex: number, info: Partial<Day>) => void; 

  // Spot Management
  addSpot: (spot: Omit<Spot, 'id' | 'category'>) => void;
  removeSpot: (spotId: string) => void;
  reorderSpots: (activeId: string, overId: string) => void;
  updateSpot: (id: string, info: Partial<Spot>) => void;
  toggleSpotExpand: (id: string) => void;
  addCategory: (category: string) => void;
  
  // Checklist Management
  addChecklistGroup: (title: string) => void;
  addChecklistItem: (groupId: string, text: string) => void;
  toggleChecklistItem: (groupId: string, itemId: string) => void;
  deleteChecklistItem: (groupId: string, itemId: string) => void;
  deleteChecklistGroup: (groupId: string) => void;
  resetChecklist: () => void;

  // Collection Management
  createCollection: (name: string, color: string, icon: string) => string;
  toggleCollectionVisibility: (id: string) => void;
  addToCollection: (collectionId: string, spot: Omit<Spot, 'id' | 'category' | 'startTime' | 'endTime'>) => void;
  removeFromCollection: (collectionId: string, spotName: string, lat: number, lng: number) => void;
  updateCollectionSpot: (collectionId: string, spotId: string, info: Partial<Spot>) => void;
  deleteCollection: (id: string) => void;

  importData: (data: Trip[]) => void;
}

const INITIAL_TRIP_ID = 'trip-default';
const DEFAULT_FLIGHT: FlightInfo = { flightNo: '', depTime: '', depAirport: '', arrTime: '', arrAirport: '' };

const createDefaultChecklist = (): ChecklistGroup[] => {
    return DEFAULT_CHECKLIST_GROUPS.map(group => ({
        id: generateId(),
        title: group.title,
        items: group.items.map(text => ({ id: generateId(), text, isChecked: false }))
    }));
};

const INITIAL_TRIPS: Trip[] = [
  {
    id: INITIAL_TRIP_ID,
    name: '我的東京冒險',
    destination: '日本東京',
    startDate: new Date().toISOString().split('T')[0],
    outbound: { ...DEFAULT_FLIGHT },
    inbound: { ...DEFAULT_FLIGHT },
    currentDayIndex: 0,
    checklistGroups: createDefaultChecklist(), 
    days: [
      {
        id: 'day-1',
        spots: [
          { id: '1', name: '淺草寺 (雷門)', category: '神社/寺廟', startTime: '10:00', endTime: '12:00', location: { lat: 35.7147, lng: 139.7967 }, website: 'https://www.senso-ji.jp/', isExpanded: false, rating: 4.7 },
        ]
      }
    ]
  }
];

// ✨ 重寫 Store 建立邏輯，移除 persist middleware，加入 API 呼叫
const useStore = create<ItineraryStore>((set, get) => ({
      trips: INITIAL_TRIPS,
      activeTripId: INITIAL_TRIP_ID,
      savedCategories: DEFAULT_CATEGORIES,
      collections: [],
      viewMode: 'day',
      
      // ✨ 雲端同步狀態
      currentProfile: null,
      isSyncing: false,

      // ✨ 登入並讀取資料
      setProfileAndLoad: async (profile) => {
          set({ currentProfile: profile, isSyncing: true });
          try {
              console.log(`正在讀取 ${profile} 的資料...`);
              const res = await fetch(`/api/sync?profileId=${profile}`);
              
              if (!res.ok) {
                  if (res.status === 404) {
                      console.warn("API 端點不存在，使用本地模式（開發環境）");
                      return;
                  }
                  throw new Error(`Server responded with ${res.status}`);
              }
              
              const contentType = res.headers.get('content-type');
              if (!contentType?.includes('application/json')) {
                  console.warn("伺服器回傳非 JSON 格式，使用本地模式");
                  return;
              }
              
              const data = await res.json();
              
              if (data && Array.isArray(data) && data.length > 0) {
                  console.log("雲端資料匯入成功！", data);
                  get().importData(data);
              } else {
                  console.log("雲端無資料，使用預設值");
                  // 嘗試從 localStorage 載入備份資料
                  try {
                      const backup = localStorage.getItem(`trip_data_${profile}`);
                      if (backup) {
                          const backupData = JSON.parse(backup);
                          if (Array.isArray(backupData) && backupData.length > 0) {
                              console.log("從本地備份載入資料");
                              get().importData(backupData);
                              return;
                          }
                      }
                  } catch (storageError) {
                      // 忽略 localStorage 錯誤
                  }
              }
          } catch (e) {
              const error = e as Error;
              if (error.message.includes('JSON') || error.message.includes('Unexpected token')) {
                  console.warn("API 端點未正確設定，使用本地模式（開發環境）");
              } else {
                  console.error("雲端讀取錯誤:", error.message);
              }
              // 錯誤時不做中斷，讓使用者可以先用預設值操作
          } finally {
              set({ isSyncing: false });
          }
      },

      // ✨ 儲存資料到雲端
      saveToCloud: async () => {
          const { currentProfile, trips } = get();
          if (!currentProfile) return;

          set({ isSyncing: true });
          try {
              const res = await fetch(`/api/sync?profileId=${currentProfile}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ data: trips })
              });
              
              if (!res.ok) {
                  if (res.status === 404) {
                      console.warn("API 端點不存在，資料僅儲存在本地（開發環境）");
                      // 在開發環境中，可以選擇使用 localStorage 作為備份
                      try {
                          localStorage.setItem(`trip_data_${currentProfile}`, JSON.stringify(trips));
                          console.log("資料已儲存至本地 localStorage");
                      } catch (storageError) {
                          console.warn("無法使用 localStorage:", storageError);
                      }
                      return;
                  }
                  throw new Error(`儲存失敗: ${res.status}`);
              }
              
              const contentType = res.headers.get('content-type');
              if (!contentType?.includes('application/json')) {
                  console.warn("伺服器回傳非 JSON 格式");
                  return;
              }
              
              console.log("雲端儲存成功！");
          } catch (e) {
              const error = e as Error;
              if (error.message.includes('Failed to fetch') || error.message.includes('404')) {
                  console.warn("API 端點未正確設定，資料僅儲存在本地（開發環境）");
                  // 開發環境備份到 localStorage
                  try {
                      localStorage.setItem(`trip_data_${currentProfile}`, JSON.stringify(trips));
                      console.log("資料已儲存至本地 localStorage");
                  } catch (storageError) {
                      console.warn("無法使用 localStorage:", storageError);
                  }
              } else {
                  console.error("雲端儲存錯誤:", error.message);
              }
          } finally {
              set({ isSyncing: false });
          }
      },

      setViewMode: (mode) => set({ viewMode: mode }),

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
          checklistGroups: createDefaultChecklist(),
          days: [{ id: generateId(), spots: [] }]
        };
        return { trips: [...state.trips, newTrip], activeTripId: newId, viewMode: 'day' };
      }),

      switchTrip: (id) => set({ activeTripId: id, viewMode: 'day' }),
      
      deleteTrip: (id) => set((state) => {
        if (state.trips.length <= 1) return state;
        const newTrips = state.trips.filter(t => t.id !== id);
        return { trips: newTrips, activeTripId: state.activeTripId === id ? newTrips[0].id : state.activeTripId };
      }),

      duplicateTrip: (id) => set((state) => {
          const tripToCopy = state.trips.find(t => t.id === id);
          if (!tripToCopy) return state;
          const newTrip = JSON.parse(JSON.stringify(tripToCopy));
          newTrip.id = generateId();
          newTrip.name = `${newTrip.name} (複製)`;
          newTrip.days.forEach((d: Day) => {
              d.id = generateId();
              d.spots.forEach((s: Spot) => s.id = generateId());
          });
          return { trips: [...state.trips, newTrip], activeTripId: newTrip.id };
      }),

      updateTripInfo: (info) => set((state) => ({
        trips: state.trips.map(t => t.id === state.activeTripId ? { ...t, ...info } : t)
      })),

      setAccommodation: (place) => set((state) => ({
          trips: state.trips.map(t => {
              if (t.id !== state.activeTripId) return t;
              return { ...t, accommodation: place };
          })
      })),

      updateFlight: (type, info) => set((state) => ({
        trips: state.trips.map(t => {
            if (t.id !== state.activeTripId) return t;
            return { ...t, [type]: { ...t[type], ...info } };
        })
      })),

      setCurrentDayIndex: (index) => set((state) => ({
        trips: state.trips.map(t => t.id === state.activeTripId ? { ...t, currentDayIndex: index } : t),
        viewMode: 'day'
      })),

      addDay: () => set((state) => ({
        trips: state.trips.map(t => {
          if (t.id !== state.activeTripId) return t;
          const newDays = [...t.days, { id: generateId(), spots: [] }];
          return { ...t, days: newDays, currentDayIndex: newDays.length - 1, viewMode: 'day' };
        })
      })),

      duplicateDay: (index) => set((state) => ({
          trips: state.trips.map(t => {
              if (t.id !== state.activeTripId) return t;
              const dayToCopy = t.days[index];
              const newDay = JSON.parse(JSON.stringify(dayToCopy));
              newDay.id = generateId();
              newDay.spots.forEach((s: Spot) => s.id = generateId());
              const newDays = [...t.days];
              newDays.splice(index + 1, 0, newDay);
              return { ...t, days: newDays, currentDayIndex: index + 1 };
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
          const newSpot: Spot = { ...spotData, id: generateId(), category: '觀光景點', startTime: '', endTime: '', isExpanded: false };
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

      // --- Checklist Actions ---
      addChecklistGroup: (title) => set((state) => ({
          trips: state.trips.map(t => {
              if (t.id !== state.activeTripId) return t;
              return { ...t, checklistGroups: [...t.checklistGroups, { id: generateId(), title, items: [] }]};
          })
      })),

      addChecklistItem: (groupId, text) => set((state) => ({
        trips: state.trips.map(t => {
            if (t.id !== state.activeTripId) return t;
            return { 
                ...t, 
                checklistGroups: t.checklistGroups.map(g => 
                    g.id === groupId ? { ...g, items: [...g.items, { id: generateId(), text, isChecked: false }] } : g
                )
            };
        })
      })),

      toggleChecklistItem: (groupId, itemId) => set((state) => ({
        trips: state.trips.map(t => {
            if (t.id !== state.activeTripId) return t;
            return { 
                ...t, 
                checklistGroups: t.checklistGroups.map(g => 
                    g.id === groupId ? { ...g, items: g.items.map(i => i.id === itemId ? { ...i, isChecked: !i.isChecked } : i) } : g
                )
            };
        })
      })),

      deleteChecklistItem: (groupId, itemId) => set((state) => ({
        trips: state.trips.map(t => {
            if (t.id !== state.activeTripId) return t;
            return { 
                ...t, 
                checklistGroups: t.checklistGroups.map(g => 
                    g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
                )
            };
        })
      })),

      deleteChecklistGroup: (groupId) => set((state) => ({
          trips: state.trips.map(t => {
              if (t.id !== state.activeTripId) return t;
              return { ...t, checklistGroups: t.checklistGroups.filter(g => g.id !== groupId) };
          })
      })),

      resetChecklist: () => set((state) => ({
          trips: state.trips.map(t => {
              if (t.id !== state.activeTripId) return t;
              return {
                  ...t,
                  checklistGroups: t.checklistGroups.map(g => ({
                      ...g,
                      items: g.items.map(i => ({ ...i, isChecked: false }))
                  }))
              };
          })
      })),

      // --- Collection Actions ---
      createCollection: (name, color, icon) => {
          const id = generateId();
          set((state) => ({
              collections: [...state.collections, { id, name, color, icon, isVisible: true, spots: [] }]
          }));
          return id;
      },
      
      toggleCollectionVisibility: (id) => set((state) => ({
          collections: state.collections.map(c => c.id === id ? { ...c, isVisible: !c.isVisible } : c)
      })),

      addToCollection: (collectionId, spotData) => set((state) => ({
          collections: state.collections.map(c => {
              if (c.id === collectionId) {
                  const exists = c.spots.some(s => s.name === spotData.name && isSameLocation(s.location, spotData.location));
                  if (exists) return c;
                  return {
                      ...c,
                      spots: [...c.spots, { ...spotData, id: generateId(), category: '收藏', startTime: '', endTime: '', isExpanded: false }]
                  };
              }
              return c;
          })
      })),

      removeFromCollection: (collectionId, spotName, lat, lng) => set((state) => ({
          collections: state.collections.map(c => 
              c.id === collectionId ? { 
                  ...c, 
                  spots: c.spots.filter(s => 
                      !(s.name === spotName && isSameLocation(s.location, { lat, lng }))
                  ) 
              } : c
          )
      })),

      updateCollectionSpot: (collectionId, spotId, info) => set((state) => ({
          collections: state.collections.map(c => 
              c.id === collectionId ? {
                  ...c,
                  spots: c.spots.map(s => s.id === spotId ? { ...s, ...info } : s)
              } : c
          )
      })),

      deleteCollection: (id) => set((state) => ({
          collections: state.collections.filter(c => c.id !== id)
      })),

      importData: (newTrips) => set(() => ({
          trips: newTrips,
          activeTripId: newTrips.length > 0 ? newTrips[0].id : INITIAL_TRIP_ID
      }))
}));

// --- 2. API 與 輔助功能 (保持不變) ---

const CATEGORY_COLORS: Record<string, string> = {
    '觀光景點': '#EF4444', '美食餐廳': '#F97316', '購物行程': '#EAB308', '咖啡廳': '#D97706',
    '神社/寺廟': '#78716C', '博物館/美術館': '#A855F7', '公園/自然': '#22C55E', '居酒屋/酒吧': '#6366F1',
    '甜點/下午茶': '#EC4899', '藥妝店': '#3B82F6', '飯店/住宿': '#64748B', '交通/車站': '#0EA5E9',
    '住宿': '#8B5CF6'
};

const getMarkerColor = (category: string): string => CATEGORY_COLORS[category] || '#9CA3AF';

const getMarkerIcon = (color: string, isBase: boolean = false) => {
    if (isBase) {
        return {
            path: "M2 20h20v-8h-2v6h-4v-6h-4v6H4v-6H2v8zm10-18l10 9h-3v4h-2v-4H7v4H5v-4H2l10-9z", 
            fillColor: color, fillOpacity: 1, strokeWeight: 1, strokeColor: "#FFFFFF", scale: 1.2,
            anchor: new google.maps.Point(12, 12),
        };
    }
    return {
        path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeWeight: 2, strokeColor: "#FFFFFF",
    };
};

const fetchFlightData = async (flightNo: string) => {
    if (!flightNo) return null;
    const cleanNo = flightNo.trim().toUpperCase();
    return new Promise<{depTime: string, arrTime: string, depAirport: string, arrAirport: string} | null>((resolve) => {
        setTimeout(() => {
            if (cleanNo.includes('BR')) resolve({ depTime: '08:50', arrTime: '13:15', depAirport: 'TPE T2', arrAirport: 'NRT T1' });
            else if (cleanNo.includes('JX')) resolve({ depTime: '10:30', arrTime: '14:45', depAirport: 'TPE T1', arrAirport: 'KIX T1' });
            else if (cleanNo.includes('CI')) resolve({ depTime: '09:00', arrTime: '12:50', depAirport: 'TSA', arrAirport: 'HND T3' });
            else resolve({ depTime: '10:00', arrTime: '14:00', depAirport: 'TPE', arrAirport: 'NRT' });
        }, 600);
    });
};

const getGoogleMapsLink = (origin: Spot, dest: Spot): string => {
    const baseUrl = "https://www.google.com/maps/dir/?api=1";
    const originStr = `${origin.location.lat},${origin.location.lng}`;
    const destStr = `${dest.location.lat},${dest.location.lng}`;
    return `${baseUrl}&origin=${originStr}&destination=${destStr}&travelmode=transit`;
};

const formatDate = (startDateStr: string, dayOffset: number): string => {
    if (!startDateStr) return "選擇日期";
    const date = new Date(startDateStr);
    if (isNaN(date.getTime())) return "無效日期";
    date.setDate(date.getDate() + dayOffset);
    return date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' });
};

const CATEGORY_STYLES: Record<string, string> = {
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

const getCategoryStyle = (category: string): string => CATEGORY_STYLES[category] || 'border-gray-400 text-gray-600 bg-gray-50';

// Helper function to check if two locations are the same
const isSameLocation = (loc1: { lat: number; lng: number }, loc2: { lat: number; lng: number }): boolean => {
    return Math.abs(loc1.lat - loc2.lat) < LOCATION_TOLERANCE && 
           Math.abs(loc1.lng - loc2.lng) < LOCATION_TOLERANCE;
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

// --- 3. UI 元件 (保持不變) ---

const SmartTimeInput = ({ value, onChange, placeholder, className }: { value: string, onChange: (val: string) => void, placeholder?: string, className?: string }) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        
        const raw = e.currentTarget.value.replace(/\D/g, '');
        if (!raw) return;
        
        const numVal = parseInt(raw, 10);
        if (numVal >= 2400) {
            onChange("23:59");
            e.currentTarget.blur();
            return;
        }
        
        let hh = 0;
        let mm = 0;
        
        if (raw.length <= 2) {
            hh = parseInt(raw, 10);
        } else if (raw.length === 3) {
            hh = parseInt(raw.substring(0, 1), 10);
            mm = parseInt(raw.substring(1), 10);
        } else {
            hh = parseInt(raw.substring(0, 2), 10);
            mm = parseInt(raw.substring(2, 4), 10);
        }
        
        hh = Math.min(hh, 23);
        mm = Math.min(mm, 59);
        
        const formatted = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
        onChange(formatted);
        e.currentTarget.blur();
    };
    const defaultClass = "text-[10px] bg-gray-50 border border-transparent hover:border-gray-200 rounded px-1 w-full text-center text-gray-600 focus:border-blue-400 outline-none font-medium transition-all";
    
    return (
        <input 
            type="text" 
            placeholder={placeholder} 
            className={className || defaultClass} 
            value={value || ''} 
            onChange={(e) => onChange(e.target.value)} 
            onKeyDown={handleKeyDown} 
        />
    );
};

const DestinationInput = ({ value, placeholder, onChange, onLocationSelect }: { value: string, placeholder?: string, onChange: (val: string) => void, onLocationSelect: (lat: number, lng: number, address?: string) => void }) => {
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const onLoad = (autocomplete: google.maps.places.Autocomplete) => { autocompleteRef.current = autocomplete; };
    const onPlaceChanged = () => {
        if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (!place || !place.geometry) return; 
            if (place.name) onChange(place.name);
            if (place.geometry.location) {
                onLocationSelect(place.geometry.location.lat(), place.geometry.location.lng(), place.formatted_address);
            }
        }
    };
    return (
        <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged} types={['geocode', 'establishment']}>
            <input value={value} onChange={(e) => onChange(e.target.value)} className="text-sm font-bold text-gray-700 w-full outline-none bg-transparent placeholder-gray-400" placeholder={placeholder || "搜尋..."} />
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
    const onLoad = (autocomplete: google.maps.places.Autocomplete) => { autocompleteRef.current = autocomplete; };
    const onPlaceChanged = () => {
        if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (!place || !place.geometry || !place.geometry.location) return; 
            onLocationSelect(place.geometry.location.lat(), place.geometry.location.lng(), place.name || "");
        }
    };
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        onChange(val);
        if (val === '') onLocationSelect(undefined, undefined, undefined);
    };
    return (
        <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged} types={['(regions)']}>
             <input className="bg-transparent outline-none w-auto min-w-[60px] max-w-[120px] placeholder-gray-400 text-gray-600 font-medium" placeholder={placeholder} value={value} onChange={handleChange} />
        </Autocomplete>
    );
};

const CollectionSelector = ({ spot }: { spot: Spot, onClose?: () => void }) => {
    const { collections, addToCollection, removeFromCollection, createCollection } = useStore();
    const [newColName, setNewColName] = useState("");
    
    const checkInCollection = (colId: string): boolean => {
        const col = collections.find(c => c.id === colId);
        if (!col || !spot.location) return false;
        return col.spots.some(s => s.name === spot.name && isSameLocation(s.location, spot.location));
    };

    const handleToggle = (colId: string) => {
        if (!spot.location) return; 
        const isCollected = checkInCollection(colId);
        if (isCollected) {
            removeFromCollection(colId, spot.name, spot.location.lat, spot.location.lng);
        } else {
            addToCollection(colId, spot);
        }
    };
    
    const handleCreate = () => {
        if (!newColName.trim() || !spot.location) return;
        const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newId = createCollection(newColName, randomColor, 'star');
        addToCollection(newId, spot);
        setNewColName("");
    };

    return (
        <div className="absolute right-0 top-8 z-50 w-60 bg-white border border-gray-200 shadow-xl rounded-xl p-3 animate-in fade-in zoom-in-95 duration-150">
            <h4 className="text-xs font-bold text-gray-500 mb-2 px-1">收藏至...</h4>
            <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                {collections.map(col => {
                    const isChecked = checkInCollection(col.id);
                    return (
                        <button key={col.id} onClick={() => handleToggle(col.id)} className="w-full text-left px-2 py-2 hover:bg-gray-50 rounded-lg flex items-center gap-3 text-sm text-gray-700 transition-colors group">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-pink-500 border-pink-500' : 'border-gray-300 group-hover:border-pink-300'}`}>
                                {isChecked && <Check size={10} className="text-white" strokeWidth={4}/>}
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="w-2 h-2 rounded-full" style={{background: col.color}}/>
                                <span className="truncate">{col.name}</span>
                            </div>
                        </button>
                    )
                })}
                {collections.length === 0 && <div className="text-xs text-gray-400 px-2 py-2 text-center">尚無收藏夾</div>}
            </div>
            <div className="flex items-center gap-1 border-t border-gray-100 pt-2">
                <Plus size={14} className="text-gray-400"/>
                <input 
                    className="w-full text-xs outline-none py-1 placeholder-gray-400" 
                    placeholder="新建收藏夾..." 
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
            </div>
        </div>
    );
};

const CustomInfoWindow = ({ 
    title, address, rating, category, buttonText, buttonColorClass, onClose, onAction, actionIcon, onHeartClick, isCollected, onDelete 
}: { 
    title: string; address: string; rating?: number; category?: string; buttonText: string; buttonColorClass: string; onClose: () => void; onAction: () => void; actionIcon: React.ReactNode; onHeartClick?: () => void; isCollected?: boolean; onDelete?: () => void;
}) => {
    const categoryStyle = category ? getCategoryStyle(category) : 'border-gray-400 text-gray-600 bg-gray-50';
    return (
        <div className="p-0 min-w-[220px] max-w-[260px]">
            <div className="flex justify-between items-start mb-1 gap-2">
                <h3 className="font-bold text-gray-800 text-base leading-tight break-words flex-1 pt-0.5">{title}</h3>
                <div className="flex items-center gap-1 shrink-0">
                    {onHeartClick && (
                        <button onClick={onHeartClick} className={`p-1 rounded hover:bg-gray-100 transition-colors ${isCollected ? 'text-pink-500 fill-pink-500' : 'text-gray-300 hover:text-pink-400'}`}>
                            <Heart size={16} fill={isCollected ? "currentColor" : "none"} />
                        </button>
                    )}
                    {onDelete && (
                        <button onClick={onDelete} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="刪除">
                            <Trash2 size={16}/>
                        </button>
                    )}
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-0.5 rounded transition-colors"><X size={16} /></button>
                </div>
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

const SortableDayTab = ({ day, index, isActive, onClick, onDelete, onDuplicate, showDelete }: { day: Day, index: number, isActive: boolean, onClick: () => void, onDelete: () => void, onDuplicate: () => void, showDelete: boolean }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: day.id });
    const style = { transform: CSS.Translate.toString(transform), transition };
    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group flex-shrink-0 touch-none">
            <button onClick={onClick} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer select-none ${isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>第 {index + 1} 天</button>
            <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="bg-blue-500 text-white rounded-full p-0.5"><Copy size={10} /></button>
                {showDelete && (<button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-red-500 text-white rounded-full p-0.5"><Trash2 size={10} /></button>)}
            </div>
        </div>
    );
};

const ChecklistPanel = () => {
    const { trips, activeTripId, addChecklistGroup, addChecklistItem, toggleChecklistItem, deleteChecklistItem, deleteChecklistGroup, resetChecklist, setViewMode } = useStore();
    const activeTrip = trips.find(t => t.id === activeTripId);
    const [newGroupTitle, setNewGroupTitle] = useState("");
    const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({}); 

    if (!activeTrip) return null;
    const groups = activeTrip.checklistGroups || [];
    const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
    const completedItems = groups.reduce((acc, g) => acc + g.items.filter(i => i.isChecked).length, 0);
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const handleAddItem = (groupId: string) => {
        const text = newItemTexts[groupId]?.trim();
        if (text) {
            addChecklistItem(groupId, text);
            setNewItemTexts(prev => ({ ...prev, [groupId]: "" }));
        }
    };
    
    const handleAddGroup = () => {
        if (newGroupTitle.trim()) {
            addChecklistGroup(newGroupTitle);
            setNewGroupTitle("");
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 relative">
            <div className="p-6 bg-white border-b border-gray-100 shadow-sm z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3"><button onClick={() => setViewMode('day')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"><ArrowLeft size={20}/></button><h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><CheckSquare className="text-indigo-600"/> 行前準備清單</h2></div>
                    <button onClick={() => { if(confirm("確定要重置所有項目嗎？")) resetChecklist(); }} className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded"><RefreshCcw size={12}/> 重置</button>
                </div>
                <div className="bg-gray-100 rounded-full h-2 w-full overflow-hidden mb-2"><div className="h-full bg-green-500 transition-all duration-500 ease-out" style={{ width: `${progress}%` }}/></div>
                <div className="flex justify-between text-xs font-bold text-gray-500"><span>完成度 {progress}%</span><span>{completedItems} / {totalItems}</span></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                {groups.map(group => (
                    <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center group/header"><h3 className="font-bold text-gray-700 text-sm">{group.title}</h3><button onClick={() => { if(confirm("刪除此分組？")) deleteChecklistGroup(group.id); }} className="text-gray-300 hover:text-red-500 opacity-0 group-hover/header:opacity-100 transition-all"><Trash2 size={14}/></button></div>
                        <div className="p-2 space-y-1">
                            {group.items.map(item => (
                                <div key={item.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg group/item transition-colors">
                                    <button onClick={() => toggleChecklistItem(group.id, item.id)} className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${item.isChecked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}`}><Check size={12} strokeWidth={4} /></button>
                                    <span className={`flex-1 text-sm ${item.isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{item.text}</span>
                                    <button onClick={() => deleteChecklistItem(group.id, item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100"><Trash2 size={14}/></button>
                                </div>
                            ))}
                            <div className="flex items-center gap-2 px-2 pt-1"><Plus size={14} className="text-gray-400"/><input className="text-sm outline-none w-full placeholder-gray-400 py-1" placeholder="新增物品..." value={newItemTexts[group.id] || ""} onChange={(e) => setNewItemTexts({ ...newItemTexts, [group.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleAddItem(group.id)}/></div>
                        </div>
                    </div>
                ))}
                <div className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 transition-colors bg-gray-50"><Plus size={18} className="text-gray-400"/><input className="bg-transparent outline-none text-sm font-bold text-gray-600 w-full placeholder-gray-400" placeholder="新增分組類別 (例如: 攝影器材)..." value={newGroupTitle} onChange={(e) => setNewGroupTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}/></div>
            </div>
        </div>
    );
};

const FlightCard = ({ type, flight, onUpdate }: { type: 'outbound' | 'inbound', flight: FlightInfo, onUpdate: (info: Partial<FlightInfo>) => void }) => {
    const [isLoading, setIsLoading] = useState(false);
    const handleAutoImport = async () => {
        if (!flight.flightNo) return;
        setIsLoading(true);
        try {
            const data = await fetchFlightData(flight.flightNo);
            if (data) onUpdate(data);
        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className={`mb-3 relative rounded-xl border p-4 shadow-sm transition-all ${type === 'outbound' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'}`}>
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full text-white shrink-0 ${type === 'outbound' ? 'bg-blue-500' : 'bg-orange-500'}`}>{type === 'outbound' ? <PlaneTakeoff size={20} /> : <PlaneLanding size={20} />}</div>
                <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-3 flex items-center gap-1"><div className="flex flex-col w-full"><label className="text-[10px] uppercase font-bold text-gray-400">航班代號</label><div className="flex items-center border-b border-gray-300 focus-within:border-blue-500"><input className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none uppercase placeholder-gray-300" placeholder="BR198" value={flight.flightNo} onChange={(e) => onUpdate({ flightNo: e.target.value })}/><button onClick={handleAutoImport} disabled={isLoading} className="p-1 hover:bg-gray-200 rounded-full text-blue-500 transition-colors">{isLoading ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12} />}</button></div></div></div>
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

const SpotCard = ({ spot, index, isLast, updateSpot, toggleSpotExpand, removeSpot, savedCategories, addCategory, collections }: { 
    spot: Spot; index: number; isLast: boolean; updateSpot: (id: string, info: Partial<Spot>) => void; toggleSpotExpand: (id: string) => void; removeSpot: (id: string) => void; savedCategories: string[]; addCategory: (cat: string) => void; collections: Collection[];
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: spot.id });
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [isCollectionOpen, setIsCollectionOpen] = useState(false); 
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [searchCat, setSearchCat] = useState("");
    
    const isCollected = collections.some(c => 
        c.spots.some(s => s.name === spot.name && isSameLocation(s.location, spot.location))
    );

    useEffect(() => {
        if (!isCategoryOpen) return;
        
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsCategoryOpen(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        searchInputRef.current?.focus();
        
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isCategoryOpen]);

    const style = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 100 : (isCategoryOpen || isCollectionOpen ? 50 : 'auto'), position: 'relative' as const };
    const categoryStyle = getCategoryStyle(spot.category || 'other');
    const filteredCats = savedCategories.filter(c => c.toLowerCase().includes(searchCat.toLowerCase()));

    return (
      <div ref={setNodeRef} style={style} className="relative mb-2 group touch-none">
        <div className={`bg-white rounded-xl shadow-sm border transition-all ${spot.isExpanded ? 'ring-2 ring-blue-100 border-blue-300' : 'border-gray-100'}`}>
            <div className="p-3 pr-2 flex items-center gap-2">
                <div {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 p-1 hover:bg-gray-100 rounded-lg shrink-0"><GripVertical size={18} /></div>
                <button onClick={(e) => { e.stopPropagation(); toggleSpotExpand(spot.id); }} className={`p-1 rounded-md transition-colors ${spot.isExpanded ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}>{spot.isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-bold text-xs shrink-0">{index + 1}</div>
                
                <div className="flex-1 min-w-0 flex flex-col gap-1 relative">
                    <input className="font-semibold text-gray-800 text-sm bg-transparent outline-none border-b border-transparent focus:border-blue-300 w-full" value={spot.name} onChange={(e) => updateSpot(spot.id, { name: e.target.value })} placeholder="景點名稱"/>
                    <div className="relative flex items-center gap-2" ref={popoverRef}>
                        <button onClick={(e) => { e.stopPropagation(); setIsCategoryOpen(!isCategoryOpen); }} className={`text-[10px] px-2 py-0.5 rounded-full border ${categoryStyle} w-fit flex items-center gap-1 transition-all hover:brightness-95 whitespace-nowrap`}><Tag size={10} /> {spot.category}</button>
                        
                        <div className="relative">
                            <button 
                                onClick={() => setIsCollectionOpen(!isCollectionOpen)} 
                                className={`transition-colors p-0.5 ${isCollected ? 'text-pink-500' : 'text-gray-300 hover:text-pink-400'}`}
                            >
                                <Heart size={14} fill={isCollected ? "currentColor" : "none"}/>
                            </button>
                            {isCollectionOpen && (
                                <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsCollectionOpen(false)}/>
                                <CollectionSelector spot={spot} onClose={() => setIsCollectionOpen(false)} />
                                </>
                            )}
                        </div>

                        {isCategoryOpen && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 shadow-xl rounded-xl z-[999] p-3 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150 cursor-default">
                                <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input ref={searchInputRef} className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder-gray-400" placeholder="搜尋或建立新標籤..." value={searchCat} onChange={(e) => { setSearchCat(e.target.value); }} onClick={(e) => e.stopPropagation()}/></div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar"><div className="flex flex-wrap gap-2">
                                    {searchCat && !savedCategories.includes(searchCat) && (<button onClick={(e) => { e.stopPropagation(); addCategory(searchCat); updateSpot(spot.id, { category: searchCat }); setIsCategoryOpen(false); setSearchCat(""); }} className="px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-600 text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition-all shadow-sm"><Plus size={12}/> 新增 "{searchCat}"</button>)}
                                    {filteredCats.map((cat) => (<button key={cat} onClick={(e) => { e.stopPropagation(); updateSpot(spot.id, { category: cat }); setIsCategoryOpen(false); setSearchCat(""); }} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-sm active:scale-95 ${getCategoryStyle(cat)} hover:brightness-95`}>{cat}</button>))}
                                </div></div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-0.5 px-1 border-l border-gray-100 min-w-[50px]"><SmartTimeInput value={spot.startTime || ''} onChange={(val) => updateSpot(spot.id, { startTime: val })} /><div className="h-2 w-[1px] bg-gray-300 my-0.5"></div><SmartTimeInput value={spot.endTime || ''} onChange={(val) => updateSpot(spot.id, { endTime: val })} /></div>
                <button onClick={() => removeSpot(spot.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all shrink-0"><Trash2 size={14} /></button>
            </div>
            {spot.isExpanded && (<div className="px-3 pb-3 pt-0 border-t border-gray-50 bg-gray-50/50 flex flex-col gap-2 rounded-b-xl"><div className="flex items-center gap-2 mt-2 bg-white border border-gray-200 rounded-md px-2 py-1.5"><LinkIcon size={12} className="text-gray-400 shrink-0" /><input className="text-xs text-blue-600 w-full outline-none bg-transparent placeholder-gray-400 cursor-pointer" placeholder="貼上網址..." value={spot.website || ''} onChange={(e) => updateSpot(spot.id, { website: e.target.value })}/>{spot.website && (<a href={spot.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500"><ExternalLink size={12} /></a>)}</div><textarea className="w-full text-xs text-gray-600 border border-gray-200 rounded-md p-2 outline-none focus:border-blue-300 min-h-[60px] resize-none bg-white" placeholder="詳細備註..." value={spot.note || ''} onChange={(e) => updateSpot(spot.id, { note: e.target.value })} /></div>)}
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
        if (!autocompleteRef.current) return;
        const place = autocompleteRef.current.getPlace();
        if (!place.geometry?.location) return;
        onPlacePreview(place);
        setInputValue("");
    };
    return (
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2 font-sans w-[calc(100%-2rem)] max-w-md pointer-events-none">
         <button onClick={onMenuClick} className="pointer-events-auto p-3 bg-white shadow-lg rounded-lg text-gray-600 hover:text-blue-600 transition-all flex-shrink-0"><Menu size={20} /></button>
         <div className="pointer-events-auto relative flex-1 shadow-lg rounded-lg min-w-0"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-20"><Search size={16} className="text-gray-400" /></div><Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged} options={{ fields: ["geometry", "name", "formatted_address", "place_id", "rating", "website"] }}><input type="text" placeholder="搜尋地點..." className="block w-full pl-10 pr-3 py-3 rounded-lg leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm truncate" value={inputValue} onChange={(e) => setInputValue(e.target.value)}/></Autocomplete></div>
      </div>
    );
};

const CollectionsPanel = () => {
    const { collections, createCollection, deleteCollection, toggleCollectionVisibility, removeFromCollection, updateCollectionSpot, setViewMode } = useStore();
    const [newName, setNewName] = useState("");
    const [selectedIcon, setSelectedIcon] = useState("star");
    const [expandedSpots, setExpandedSpots] = useState<Record<string, boolean>>({}); 

    const colors = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7', '#EC4899'];
    
    const handleCreate = () => {
        if (!newName.trim()) return;
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        createCollection(newName, randomColor, selectedIcon);
        setNewName("");
    };

    const toggleExpand = (id: string) => {
        setExpandedSpots(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleUrlClick = (e: React.MouseEvent, url?: string) => {
        if (e.ctrlKey && url) {
            e.preventDefault();
            window.open(url, '_blank');
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 relative">
            <div className="p-6 bg-white border-b border-gray-100 shadow-sm z-10">
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => setViewMode('day')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"><ArrowLeft size={20}/></button>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><FolderHeart className="text-pink-500"/> 我的收藏夾</h2>
                </div>
                <div className="flex flex-col gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-2">
                        <Plus size={18} className="ml-2 text-gray-400" />
                        <input className="flex-1 bg-transparent px-2 py-1 outline-none text-sm" placeholder="新增收藏分類..." value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()}/>
                    </div>
                    <div className="flex gap-2 pl-9 pb-1 overflow-x-auto no-scrollbar">
                        {ICONS.map(i => (
                            <button 
                                key={i.id} 
                                onClick={() => setSelectedIcon(i.id)}
                                className={`p-1.5 rounded-lg border transition-all ${selectedIcon === i.id ? 'bg-pink-100 border-pink-300 text-pink-600' : 'bg-white border-gray-200 text-gray-400'}`}
                                title={i.label}
                            >
                                {i.icon}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {collections.length === 0 && <div className="text-center text-gray-400 py-10">還沒有收藏夾，快建立一個吧！✨</div>}
                {collections.map(col => {
                    const iconDef = ICONS.find(i => i.id === col.icon) || ICONS[0];
                    return (
                        <div key={col.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm group">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: col.color }}>{iconDef.icon}</div>
                                    <h3 className="font-bold text-gray-700">{col.name}</h3>
                                    <span className="text-xs text-gray-400">({col.spots.length})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => toggleCollectionVisibility(col.id)} className={`p-1.5 rounded transition-colors ${col.isVisible ? 'text-blue-500 bg-blue-50' : 'text-gray-300 hover:bg-gray-100'}`} title={col.isVisible ? "地圖上可見" : "地圖上隱藏"}>
                                        {col.isVisible ? <Eye size={16}/> : <EyeOff size={16}/>}
                                    </button>
                                    <button onClick={() => deleteCollection(col.id)} className="text-gray-300 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                {col.spots.map(spot => {
                                    const isExpanded = expandedSpots[spot.id];
                                    return (
                                        <div key={spot.id} className={`group/item text-xs text-gray-500 bg-gray-50 rounded border border-transparent hover:border-gray-200 overflow-hidden transition-all ${isExpanded ? 'bg-white border-gray-200 shadow-sm' : ''}`}>
                                            <div className="flex items-center justify-between px-2 py-1.5 cursor-pointer" onClick={() => toggleExpand(spot.id)}>
                                                <div className="flex items-center gap-1 min-w-0">
                                                    {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                                    <span className="truncate font-medium">{spot.name}</span>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); removeFromCollection(col.id, spot.name, spot.location.lat, spot.location.lng); }}
                                                    className="opacity-0 group-hover/item:opacity-100 text-gray-300 hover:text-red-500 p-1"
                                                >
                                                    <X size={12}/>
                                                </button>
                                            </div>
                                            {isExpanded && (
                                                <div className="px-3 pb-3 pt-0 border-t border-gray-50 flex flex-col gap-2">
                                                    <div className="flex items-center gap-2 mt-2 bg-gray-50 border border-gray-100 rounded-md px-2 py-1.5">
                                                        <LinkIcon size={12} className="text-gray-400 shrink-0" />
                                                        <input 
                                                            className="text-xs text-blue-600 w-full outline-none bg-transparent placeholder-gray-400 cursor-pointer" 
                                                            placeholder="貼上網址..." 
                                                            value={spot.website || ''} 
                                                            onChange={(e) => updateCollectionSpot(col.id, spot.id, { website: e.target.value })}
                                                            onClick={(e) => handleUrlClick(e, spot.website)}
                                                        />
                                                        {spot.website && (<a href={spot.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-500"><ExternalLink size={12} /></a>)}
                                                    </div>
                                                    <textarea 
                                                        className="w-full text-xs text-gray-600 border border-gray-100 rounded-md p-2 outline-none focus:border-blue-300 min-h-[50px] resize-none bg-gray-50 focus:bg-white transition-colors" 
                                                        placeholder="詳細備註..." 
                                                        value={spot.note || ''} 
                                                        onChange={(e) => updateCollectionSpot(col.id, spot.id, { note: e.target.value })} 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {col.spots.length === 0 && <div className="text-xs text-gray-300 italic px-2">無地點</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { trips, activeTripId, createTrip, switchTrip, deleteTrip, duplicateTrip, setViewMode } = useStore();
    return (
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white"><h2 className="font-bold flex items-center gap-2"><FolderOpen size={20}/> 我的行程庫</h2><button onClick={onClose} className="hover:bg-blue-700 p-1 rounded"><X size={20}/></button></div>
            <div className="p-4 overflow-y-auto h-full pb-20 flex flex-col gap-2">
                {trips.map(trip => (<div key={trip.id} onClick={() => { switchTrip(trip.id); onClose(); }} className={`group p-3 rounded-lg cursor-pointer border transition-all relative ${activeTripId === trip.id ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}><div className="flex justify-between items-start"><h3 className={`font-bold ${activeTripId === trip.id ? 'text-blue-700' : 'text-gray-700'}`}>{trip.name}</h3><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); duplicateTrip(trip.id); }} className="text-gray-400 hover:text-blue-500"><Copy size={14} /></button>{trips.length > 1 && <button onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id); }} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}</div></div><p className="text-xs text-gray-500 mt-1">{trip.destination} • {trip.days.length} 天</p></div>))}
                <button onClick={createTrip} className="w-full py-3 mt-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-colors font-medium"><FilePlus size={18} /> 建立新行程</button>
                <div className="h-[1px] bg-gray-100 w-full my-2"></div>
                <button onClick={() => { setViewMode('checklist'); onClose(); }} className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors font-bold border border-indigo-100"><CheckSquare size={18} /> 準備清單</button>
                <button onClick={() => { setViewMode('collections'); onClose(); }} className="w-full py-3 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center gap-2 hover:bg-pink-100 transition-colors font-bold border border-pink-100 mt-2"><FolderHeart size={18} /> 收藏夾</button>
            </div>
        </div>
    );
};

// ✨ 4. 登入遮罩元件
const LoginModal = () => {
    const { currentProfile, setProfileAndLoad } = useStore();
    const [loading, setLoading] = useState(false);

    if (currentProfile) return null; // 已登入就不顯示

    const handleLogin = async (role: 'admin' | 'visitor') => {
        setLoading(true);
        await setProfileAndLoad(role);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 mb-2">東京冒險 🇯🇵</h1>
                    <p className="text-slate-500 font-medium">請選擇您的身份</p>
                </div>
                <div className="space-y-3">
                    <button onClick={() => handleLogin('admin')} disabled={loading} className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-lg hover:bg-blue-700 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin"/> : "Admin (管理者)"}
                    </button>
                    <button onClick={() => handleLogin('visitor')} disabled={loading} className="w-full py-4 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-bold text-lg hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50">
                        Visitor (訪客)
                    </button>
                </div>
                <p className="text-xs text-slate-400">兩個身份的行程資料是分開儲存的</p>
            </div>
        </div>
    );
};

// --- 5. 主程式 ---

export default function VacationPlanner() {
    const { 
        trips, activeTripId, savedCategories, collections,
        setCurrentDayIndex, addDay, duplicateDay, deleteDay,
        addSpot, removeSpot, reorderSpots, updateSpot, toggleSpotExpand, addCategory,
        updateTripInfo, updateFlight, reorderDays, updateDayInfo,
        setAccommodation,
        viewMode,
        // ✨ 同步相關
        currentProfile, saveToCloud, isSyncing
    } = useStore();
    
    // ✨ 自動儲存邏輯 (Debounce)
    useEffect(() => {
        if (!currentProfile) return;
        const timer = setTimeout(() => saveToCloud(), AUTO_SAVE_DELAY);
        return () => clearTimeout(timer);
    }, [trips, currentProfile, saveToCloud]);

    const activeTrip = trips.find(t => t.id === activeTripId) || trips[0];
    const { days, currentDayIndex, destination, startDate, name: tripName, outbound, inbound, accommodation } = activeTrip;
    
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const mapRef = useRef<google.maps.Map | null>(null);
    
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string; address: string; placeId?: string; rating?: number; website?: string, note?: string } | null>(null); 
    const [selectedSpotToRemove, setSelectedSpotToRemove] = useState<Spot | null>(null);
    const [selectedAccommodation, setSelectedAccommodation] = useState<Accommodation | null>(null); 
    
    const [isPickingAccommodation, setIsPickingAccommodation] = useState(false);
    const [mapCollectionSelectorOpen, setMapCollectionSelectorOpen] = useState(false);

    const [leftWidth, setLeftWidth] = useState(60); 
    const [isResizing, setIsResizing] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
    const [mobileTab, setMobileTab] = useState<'map' | 'list'>('list'); 
  
    useEffect(() => {
      const handleResize = () => setIsDesktop(window.innerWidth >= 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);
  
    const startResizing = useCallback(() => { setIsResizing(true); }, []);
    const stopResizing = useCallback(() => { setIsResizing(false); }, []);
    const resize = useCallback((e: MouseEvent) => {
        if (!isResizing) return;
        const newWidth = (e.clientX / window.innerWidth) * 100;
        if (newWidth > 20 && newWidth < 80) {
            setLeftWidth(newWidth);
        }
    }, [isResizing]);
  
    useEffect(() => {
        if (!isResizing) return;
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing, resize, stopResizing]);
  
    const onLoadMap = React.useCallback((map: google.maps.Map) => { mapRef.current = map; }, []);
    const onUnmountMap = React.useCallback(() => { mapRef.current = null; }, []);
  
    const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: LIBRARIES, language: 'zh-TW' });
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id && over?.id) {
            reorderSpots(active.id as string, over.id as string);
        }
    };
    
    const handleDestinationSelect = (lat: number, lng: number) => {
        if (mapRef.current) {
            mapRef.current.panTo({ lat, lng });
            mapRef.current.setZoom(12);
        }
    };
    const currentDayData = days[currentDayIndex] || { spots: [] };
    const currentSpots = currentDayData.spots;
    const mapCenter = useMemo(() => 
        currentSpots.length > 0 ? currentSpots[0].location : DEFAULT_MAP_CENTER, 
        [currentSpots]
    );
    const { weather, loading: weatherLoading, autoLocationName } = useWeather(mapCenter.lat, mapCenter.lng, startDate, currentDayIndex);
    const displayedLocationName = currentDayData.customLocation || autoLocationName;
  
    const onMapClick = React.useCallback((e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      if (isPickingAccommodation) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              let address = "";
              if (status === "OK" && results && results[0]) address = results[0].formatted_address;
              setAccommodation({ name: "自選住宿點", location: { lat, lng }, address });
              setIsPickingAccommodation(false);
          });
          return;
      }

      setSelectedSpotToRemove(null);
      setSelectedLocation(null);
      setSelectedAccommodation(null); 
      setMapCollectionSelectorOpen(false);

      const event = e as google.maps.MapMouseEvent & { placeId?: string };
      
      if (event.placeId) {
          e.stop();
          if (!mapRef.current) return;
          const service = new google.maps.places.PlacesService(mapRef.current);
          service.getDetails(
              { placeId: event.placeId, fields: ['name', 'formatted_address', 'geometry', 'rating', 'website'] },
              (place, status) => {
                  if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                      setSelectedLocation({
                          lat: place.geometry.location.lat(),
                          lng: place.geometry.location.lng(),
                          name: place.name || "未知名稱",
                          address: place.formatted_address || "",
                          placeId: event.placeId,
                          rating: place.rating,
                          website: place.website
                      });
                  }
              }
          );
      } else {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              let spotName = "自選地點";
              let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              if (status === "OK" && results?.[0]) {
                  address = results[0].formatted_address;
                  const parts = address.split(' ');
                  if (parts.length > 0) spotName = parts[parts.length - 1];
              }
              setSelectedLocation({ lat, lng, name: spotName, address });
          });
      }
    }, [isPickingAccommodation]);
  
    const handlePlacePreview = (place: google.maps.places.PlaceResult) => {
       if (place.geometry && place.geometry.location && place.name) {
           const lat = place.geometry.location.lat();
           const lng = place.geometry.location.lng();
           if(mapRef.current) { mapRef.current.panTo({ lat, lng }); mapRef.current.setZoom(15); }
           setSelectedLocation({ lat, lng, name: place.name, address: place.formatted_address || "", placeId: place.place_id, rating: place.rating, website: place.website });
           setSelectedSpotToRemove(null);
           if (!isDesktop) setMobileTab('map');
       }
    };
    
    const handleDayDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id && over?.id) {
            const oldIndex = days.findIndex(d => d.id === active.id);
            const newIndex = days.findIndex(d => d.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                reorderDays(oldIndex, newIndex);
            }
        }
    };
    const polylinePath = currentSpots.map(s => s.location);
    const currentDateDisplay = formatDate(startDate, currentDayIndex);
    const isFirstDay = currentDayIndex === 0;
    const isLastDay = currentDayIndex === days.length - 1;
  
    if (loadError) return <div className="p-10 text-red-500 font-bold">載入地圖失敗，請檢查 API Key 額度與權限設定。</div>;
  
    return (
      <div className="flex h-[100dvh] w-full bg-gray-50 overflow-hidden flex-col md:flex-row font-sans relative select-none">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
        {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setSidebarOpen(false)} />}
        
        {/* ✨ 1. 加入登入遮罩 */}
        <LoginModal />

        {/* ✨ 2. 同步狀態指示器 */}
        {isSyncing && (
            <div className="fixed top-4 right-4 z-[100] bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-blue-600 shadow border border-blue-100 flex items-center gap-2 animate-pulse pointer-events-none">
                <Loader2 size={12} className="animate-spin"/> 同步中...
            </div>
        )}

        {isPickingAccommodation && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-white px-6 py-3 rounded-full shadow-xl border-2 border-indigo-500 flex items-center gap-3 animate-in slide-in-from-top-4">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"/>
                <span className="font-bold text-gray-700">點擊地圖設定住宿位置...</span>
                <button onClick={() => setIsPickingAccommodation(false)} className="ml-2 text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
        )}

        <div style={{ width: isDesktop ? `${leftWidth}%` : '100%' }} className={`${!isDesktop && mobileTab !== 'map' ? 'hidden' : 'flex'} h-full md:h-full relative order-2 md:order-1 bg-gray-200 flex-col`}>
          {!isLoaded ? (<div className="flex h-full w-full items-center justify-center text-gray-500 gap-2"><Loader2 className="animate-spin" /> 地圖載入中...</div>) : (
            <>
              <HeaderControls onMenuClick={() => setSidebarOpen(true)} onPlacePreview={handlePlacePreview} />
              <GoogleMap 
                  mapContainerStyle={{ width: '100%', height: '100%' }} 
                  center={mapCenter} 
                  zoom={DEFAULT_ZOOM} 
                  options={{ 
                      disableDefaultUI: true, 
                      zoomControl: true, 
                      gestureHandling: 'greedy', 
                      draggableCursor: isPickingAccommodation ? 'crosshair' : '' 
                  }} 
                  onClick={onMapClick} 
                  onDragStart={() => setSelectedLocation(null)} 
                  onLoad={onLoadMap} 
                  onUnmount={onUnmountMap}
              >
                  {accommodation && (
                      <Marker 
                        position={accommodation.location} 
                        icon={getMarkerIcon('#EF4444', true)} 
                        label={{ text: "🏠", color: "white", className: "mt-[-20px]" }} 
                        zIndex={999}
                        onClick={() => setSelectedAccommodation(accommodation)}
                      />
                  )}

                  {collections.filter(c => c.isVisible).map(col => (
                      col.spots.map(spot => (
                          <Marker 
                            key={`col-${col.id}-${spot.id}`} 
                            position={spot.location} 
                            icon={getMarkerIcon(col.color, false)} 
                            zIndex={50}
                            onClick={() => { 
                                setSelectedLocation({
                                    lat: spot.location.lat,
                                    lng: spot.location.lng,
                                    name: spot.name,
                                    address: spot.address || "",
                                    website: spot.website, 
                                    note: spot.note,       
                                    rating: spot.rating
                                });
                                setSelectedSpotToRemove(null);
                            }}
                            title={spot.name}
                          />
                      ))
                  ))}

                  {currentSpots.map((spot, index) => (
                    <Marker 
                        key={`${spot.id}-${index}`} 
                        position={spot.location} 
                        icon={getMarkerIcon(getMarkerColor(spot.category))} 
                        label={{ text: (index + 1).toString(), color: "white", fontWeight: "bold" }} 
                        onClick={() => { setSelectedLocation(null); setSelectedSpotToRemove(spot); }} 
                    />
                  ))}
                  
                  <Polyline path={polylinePath} options={{ strokeColor: "#3B82F6", strokeOpacity: 0.8, strokeWeight: 4 }} />
                  
                  {selectedLocation && !isPickingAccommodation && (
                      <InfoWindow 
                        position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }} 
                        onCloseClick={() => {
                            setSelectedLocation(null);
                            setMapCollectionSelectorOpen(false);
                        }} 
                        options={{ headerDisabled: true }}
                      >
                          <div className="relative">
                            {(() => {
                                const existingSpot = currentSpots.find(s => 
                                    s.name === selectedLocation.name && 
                                    isSameLocation(s.location, { lat: selectedLocation.lat, lng: selectedLocation.lng })
                                );
                                const isAdded = !!existingSpot;

                                return (
                                    <CustomInfoWindow 
                                        title={selectedLocation.name} 
                                        address={selectedLocation.address} 
                                        rating={selectedLocation.rating} 
                                        buttonText={isAdded ? "移除此景點" : "加入行程"} 
                                        buttonColorClass={isAdded ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" : "bg-blue-600 text-white hover:bg-blue-700"} 
                                        actionIcon={isAdded ? <Trash2 size={16}/> : <Plus size={16} />} 
                                        onClose={() => {
                                            setSelectedLocation(null);
                                            setMapCollectionSelectorOpen(false);
                                        }} 
                                        onAction={() => { 
                                            if (isAdded) {
                                                removeSpot(existingSpot.id); 
                                                setSelectedLocation(null); 
                                            } else {
                                                addSpot({ 
                                                    name: selectedLocation.name, 
                                                    location: { lat: selectedLocation.lat, lng: selectedLocation.lng }, 
                                                    address: selectedLocation.address, 
                                                    website: selectedLocation.website, 
                                                    note: selectedLocation.note,       
                                                    rating: selectedLocation.rating 
                                                }); 
                                                setSelectedLocation(null); 
                                                if (!isDesktop) setMobileTab('list'); 
                                            }
                                        }}
                                        onHeartClick={() => setMapCollectionSelectorOpen(!mapCollectionSelectorOpen)}
                                        isCollected={collections.some(c => 
                                            c.spots.some(s => 
                                                s.name === selectedLocation.name && 
                                                isSameLocation(s.location, { lat: selectedLocation.lat, lng: selectedLocation.lng })
                                            )
                                        )}
                                    />
                                );
                            })()}
                            
                            {mapCollectionSelectorOpen && (
                                <div className="absolute top-0 left-full ml-2">
                                    <CollectionSelector 
                                        spot={{
                                            ...selectedLocation,
                                            id: 'temp', 
                                            category: '觀光景點',
                                            location: { lat: selectedLocation.lat, lng: selectedLocation.lng }
                                        }} 
                                        onClose={() => setMapCollectionSelectorOpen(false)}
                                    />
                                </div>
                            )}
                          </div>
                      </InfoWindow>
                  )}
  
                  {selectedSpotToRemove && (
                      <InfoWindow 
                        position={selectedSpotToRemove.location} 
                        onCloseClick={() => {
                            setSelectedSpotToRemove(null);
                            setMapCollectionSelectorOpen(false); 
                        }} 
                        options={{ headerDisabled: true }}
                      >
                          <div className="relative">
                              <CustomInfoWindow 
                                  title={selectedSpotToRemove.name} 
                                  address={selectedSpotToRemove.address || "已在行程中"} 
                                  rating={selectedSpotToRemove.rating} 
                                  category={selectedSpotToRemove.category} 
                                  buttonText="移除此景點" 
                                  buttonColorClass="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" 
                                  actionIcon={<Trash2 size={16} />} 
                                  onClose={() => {
                                      setSelectedSpotToRemove(null);
                                      setMapCollectionSelectorOpen(false);
                                  }} 
                                  onAction={() => { removeSpot(selectedSpotToRemove.id); setSelectedSpotToRemove(null); }}
                                  onHeartClick={() => setMapCollectionSelectorOpen(!mapCollectionSelectorOpen)}
                                  isCollected={collections.some(c => 
                                      c.spots.some(s => 
                                          s.name === selectedSpotToRemove.name && 
                                          isSameLocation(s.location, selectedSpotToRemove.location)
                                      )
                                  )}
                              />
                              {mapCollectionSelectorOpen && (
                                  <div className="absolute top-0 left-full ml-2">
                                      <CollectionSelector 
                                          spot={selectedSpotToRemove} 
                                          onClose={() => setMapCollectionSelectorOpen(false)}
                                      />
                                  </div>
                              )}
                          </div>
                      </InfoWindow>
                  )}

                  {selectedAccommodation && (
                      <InfoWindow position={selectedAccommodation.location} onCloseClick={() => setSelectedAccommodation(null)} options={{ headerDisabled: true }}>
                          <div className="p-1 min-w-[200px]">
                              <h3 className="font-bold text-gray-800 mb-2">{selectedAccommodation.name}</h3>
                              <p className="text-xs text-gray-500 mb-3">{selectedAccommodation.address || "自選位置"}</p>
                              <button 
                                  onClick={() => { setAccommodation(undefined); setSelectedAccommodation(null); }}
                                  className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm font-bold hover:bg-red-100 flex items-center justify-center gap-2"
                              >
                                  <Trash2 size={16}/> 刪除住宿
                              </button>
                          </div>
                      </InfoWindow>
                  )}
              </GoogleMap>
            </>
          )}
        </div>
  
        <div className="hidden md:flex w-2 bg-gray-100 hover:bg-blue-400 cursor-col-resize items-center justify-center z-50 transition-colors order-1 md:order-1 relative group" onMouseDown={startResizing} onDoubleClick={() => setLeftWidth(60)} title="點兩下重置比例"><div className="h-8 w-[2px] bg-gray-300 rounded-full group-hover:bg-white transition-colors" /></div>
  
        <div style={{ width: isDesktop ? `${100 - leftWidth}%` : '100%' }} className={`${!isDesktop && mobileTab !== 'list' ? 'hidden' : 'flex'} h-full flex-col bg-white order-1 md:order-2 z-20 shadow-xl overflow-hidden`}>
          {viewMode === 'checklist' ? (<ChecklistPanel />) : viewMode === 'collections' ? (<CollectionsPanel />) : (
              <>
                <div className="px-6 py-4 bg-white border-b border-gray-100 flex flex-col gap-3">
                    <div className="flex items-center gap-2"><button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-500"><Menu size={20} /></button><Layout size={18} className="text-blue-500 hidden md:block" /><input value={tripName} onChange={(e) => updateTripInfo({ name: e.target.value })} className="text-xl font-extrabold text-gray-800 w-full outline-none placeholder-gray-300 border-b border-transparent focus:border-blue-300 transition-colors" placeholder="輸入行程名稱..." /></div>
                    <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg"><MapPin size={16} className="text-gray-400 shrink-0" />{isLoaded && (<DestinationInput value={destination} onChange={(val) => updateTripInfo({ destination: val })} onLocationSelect={handleDestinationSelect}/>)}</div>
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg"><CalendarIcon size={16} className="text-gray-400 shrink-0" /><input type="date" value={startDate} onChange={(e) => updateTripInfo({ startDate: e.target.value })} className="text-sm text-gray-700 outline-none font-medium bg-transparent w-full" /></div>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-purple-50 px-3 py-2 rounded-lg border border-purple-100">
                            <Hotel size={16} className="text-purple-500 shrink-0" />
                            {isLoaded && (
                                <DestinationInput 
                                    placeholder="設定住宿/飯店位置..."
                                    value={accommodation?.name || ""} 
                                    onChange={(val) => setAccommodation(val ? { ...accommodation!, name: val } : undefined)} 
                                    onLocationSelect={(lat, lng, addr) => setAccommodation({ name: accommodation?.name || "住宿", location: { lat, lng }, address: addr })}
                                />
                            )}
                            <button 
                                onClick={() => setIsPickingAccommodation(true)} 
                                className={`p-1.5 rounded hover:bg-purple-100 text-purple-400 hover:text-purple-600 transition-colors ${isPickingAccommodation ? 'bg-purple-200 text-purple-700' : ''}`} 
                                title="在地圖上選擇"
                            >
                                <MapIcon size={16}/>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 overflow-x-auto no-scrollbar">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
                        <SortableContext items={days.map(d => d.id)} strategy={horizontalListSortingStrategy}>
                            {days.map((day, index) => (<SortableDayTab key={day.id} day={day} index={index} isActive={viewMode === 'day' && currentDayIndex === index} onClick={() => setCurrentDayIndex(index)} onDelete={() => deleteDay(index)} onDuplicate={() => duplicateDay(index)} showDelete={days.length > 1}/>))}
                        </SortableContext>
                    </DndContext>
                    <button onClick={addDay} className="p-1.5 rounded-full bg-white border border-dashed border-gray-300 hover:border-blue-500 hover:text-blue-500 transition-colors shrink-0"><Plus size={16} /></button>
                </div>

                <div className="px-6 py-3 border-b border-gray-100 bg-white flex justify-between items-center">
                    <div>
                        <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-gray-800">第 {currentDayIndex + 1} 天行程</h2><div className="flex items-center text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full hover:bg-gray-200 transition-colors group/edit cursor-text"><MapPin size={10} className="mr-1"/>{isLoaded && (<DayLocationInput value={displayedLocationName} placeholder="區域 (自動偵測)" onChange={(val) => updateDayInfo(currentDayIndex, { customLocation: val })} onLocationSelect={(lat, lng, name) => { updateDayInfo(currentDayIndex, { customLocation: name, customLat: lat, customLng: lng }); }}/>)}<Edit3 size={10} className="ml-1 opacity-0 group-hover/edit:opacity-100 transition-opacity" /></div></div>
                        <div className="text-sm text-gray-500">{currentDateDisplay}</div>
                    </div>
                    <div className="flex flex-col items-end">{weatherLoading ? (<div className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="animate-spin" size={12}/>更新氣象中</div>) : weather ? (<div className="flex flex-col items-end"><div className="flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">{weather.icon}<span className="text-sm font-semibold text-gray-700">{weather.text}</span></div></div>) : null}</div>
                </div>
        
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 pb-24 md:pb-4">
                    {isFirstDay && <FlightCard type="outbound" flight={outbound} onUpdate={(info) => updateFlight('outbound', info)} />}
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={currentSpots} strategy={verticalListSortingStrategy}>
                        {currentSpots.length === 0 ? (<div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm"><Search size={32} className="mb-2 opacity-50"/><p>在地圖上搜尋或點選來新增景點</p></div>) : (currentSpots.map((spot, index) => (<React.Fragment key={spot.id}><SpotCard spot={spot} index={index} isLast={index === currentSpots.length - 1} updateSpot={updateSpot} toggleSpotExpand={toggleSpotExpand} removeSpot={removeSpot} savedCategories={savedCategories} addCategory={addCategory} collections={collections}/>{index < currentSpots.length - 1 && (<div className="flex justify-center py-2 relative z-10"><a href={getGoogleMapsLink(spot, currentSpots[index + 1])} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200 shadow-sm hover:bg-green-100 transition-colors"><Navigation size={12} /><span>交通方式</span><ExternalLink size={10} /></a></div>)}</React.Fragment>)))}
                    </SortableContext>
                    </DndContext>
                    {isLastDay && <FlightCard type="inbound" flight={inbound} onUpdate={(info) => updateFlight('inbound', info)} />}
                </div>
              </>
          )}
        </div>
  
        {!isDesktop && (<div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex bg-white/90 backdrop-blur shadow-lg rounded-full p-1.5 border border-gray-200"><button onClick={() => setMobileTab('map')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${mobileTab === 'map' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}><MapIcon size={18} /> 地圖</button><button onClick={() => setMobileTab('list')} className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${mobileTab === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}><List size={18} /> 行程</button></div>)}
      </div>
    );
}