# Vacation Planner - Comprehensive Refactoring Plan

## Executive Summary

This refactoring plan addresses critical maintainability, readability, and performance issues in the vacation planner application. The primary concern is a **1,860-line monolithic `App.tsx` file** that contains all business logic, UI components, state management, and API calls. This plan will transform the codebase into a well-organized, maintainable, and performant application while maintaining 100% of existing functionality.

### Key Improvements

1. **Project Structure**: Migrate from flat structure to feature-based organization
2. **Code Organization**: Break down monolithic component into 20+ focused modules
3. **TypeScript**: Eliminate all `any` types and add proper interfaces
4. **Performance**: Add memoization, optimize re-renders, and improve bundle size
5. **Maintainability**: Separate concerns, extract utilities, and improve code reusability
6. **API**: Convert JavaScript API to TypeScript with proper error handling

---

## 1. Project Structure & Organization

### Current State
```
src/
  ├── App.tsx (1,860 lines - everything!)
  ├── main.tsx
  ├── App.css
  └── index.css

api/
  └── trips.js (JavaScript, no types)
```

### Proposed Structure (Feature-Based)
```
src/
  ├── types/
  │   └── index.ts                    # All TypeScript interfaces
  ├── store/
  │   └── useItineraryStore.ts        # Zustand store (extracted)
  ├── hooks/
  │   ├── useWeather.ts               # Weather fetching hook
  │   ├── useMap.ts                   # Map-related hooks
  │   └── useResize.ts                # Resize handler hook
  ├── utils/
  │   ├── date.ts                     # Date formatting utilities
  │   ├── flight.ts                   # Flight API utilities
  │   ├── category.ts                 # Category styling utilities
  │   └── cn.ts                       # Tailwind class name utility
  ├── components/
  │   ├── common/
  │   │   ├── Button.tsx
  │   │   ├── Input.tsx
  │   │   └── Modal.tsx
  │   ├── map/
  │   │   ├── GoogleMapContainer.tsx
  │   │   ├── MapHeader.tsx
  │   │   └── MapMarker.tsx
  │   ├── itinerary/
  │   │   ├── DayTabs.tsx
  │   │   ├── DayTab.tsx
  │   │   ├── SpotCard.tsx
  │   │   ├── SpotDetailModal.tsx
  │   │   ├── FlightCard.tsx
  │   │   └── DayHeader.tsx
  │   ├── trip/
  │   │   ├── TripSidebar.tsx
  │   │   ├── TripDetailModal.tsx
  │   │   └── TripHeader.tsx
  │   ├── views/
  │   │   ├── TranslateView.tsx
  │   │   └── BudgetView.tsx
  │   └── layout/
  │       ├── AppLayout.tsx
  │       └── ResizeHandle.tsx
  ├── api/
  │   └── trips.ts                    # API client functions
  ├── constants/
  │   └── index.ts                    # Constants (categories, defaults)
  ├── App.tsx                         # Main orchestrator (now ~100 lines)
  ├── main.tsx
  └── index.css

api/
  └── trips.ts                        # TypeScript API handler
```

---

## 2. Clean Code & Readability

### Issue 1: Monolithic Component

**Before:**
- Single 1,860-line file with everything
- Hard to navigate, test, and maintain
- Mixed concerns (UI, state, API, utilities)

**After:**
- Feature-based component structure
- Each component < 200 lines
- Clear separation of concerns

### Issue 2: Repeated Code Patterns

**Before:**
```typescript
// Repeated throughout App.tsx
const trip = state.trips.find(t => t.id === state.activeTripId);
if (trip?.isLocked) return state;
```

**After:**
```typescript
// utils/trip.ts
export const getActiveTrip = (trips: Trip[], activeTripId: string): Trip | undefined => {
  return trips.find(t => t.id === activeTripId);
};

export const isTripLocked = (trip: Trip | undefined): boolean => {
  return trip?.isLocked ?? false;
};

// Usage in store
updateTripInfo: (info) => set((state) => {
  const trip = getActiveTrip(state.trips, state.activeTripId);
  if (isTripLocked(trip)) return state;
  // ...
})
```

### Issue 3: Inline Conditional Styling

**Before:**
```typescript
className={`${className} ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400' : ''}`}
```

**After:**
```typescript
// utils/cn.ts (using tailwind-merge)
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}

// Usage
className={cn(
  "base-classes",
  disabled && "bg-gray-100 cursor-not-allowed text-gray-400",
  className
)}
```

### Issue 4: Magic Numbers and Strings

**Before:**
```typescript
setTimeout(() => set({ syncStatus: 'idle' }), 3000);
const RATE = 0.2; // Hardcoded in component
```

**After:**
```typescript
// constants/index.ts
export const SYNC_STATUS_TIMEOUT = 3000;
export const JPY_TO_TWD_RATE = 0.2;
export const DEFAULT_MAP_CENTER = { lat: 35.6762, lng: 139.6503 };
```

---

## 3. TypeScript Best Practices

### Issue 1: Excessive `any` Types

**Before:**
```typescript
const SmartTimeInput = ({ value, onChange, placeholder, className, disabled }: any) => {
  // ...
};

const SpotDetailModal = ({ spot, isOpen, onClose, onUpdate, onRemove, savedCategories, addCategory, removeCategory, setPickingLocation, isLocked }: any) => {
  // ...
};
```

**After:**
```typescript
// types/components.ts
export interface SmartTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export interface SpotDetailModalProps {
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

// components/itinerary/SmartTimeInput.tsx
export const SmartTimeInput: React.FC<SmartTimeInputProps> = ({
  value,
  onChange,
  placeholder,
  className,
  disabled
}) => {
  // ...
};
```

### Issue 2: Missing Type Definitions

**Before:**
```typescript
const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string; address: string; placeId?: string; rating?: number; website?: string; existingSpotId?: string } | null>(null);
```

**After:**
```typescript
// types/index.ts
export interface SelectedLocation {
  lat: number;
  lng: number;
  name: string;
  address: string;
  placeId?: string;
  rating?: number;
  website?: string;
  existingSpotId?: string;
}

// Usage
const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
```

### Issue 3: API Handler Types

**Before:**
```javascript
// api/trips.js
export default async function handler(request, response) {
  // No types
}
```

**After:**
```typescript
// api/trips.ts
import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import { Trip } from '../src/types';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  // Properly typed
}
```

---

## 4. Performance & Optimization

### Issue 1: Unnecessary Re-renders

**Before:**
```typescript
// Every state change causes full re-render
const activeTrip = trips.find(t => t.id === activeTripId) || trips[0];
const { days, currentDayIndex, startDate, name: tripName, outbound, inbound, destination, isLocked } = activeTrip;
```

**After:**
```typescript
// hooks/useActiveTrip.ts
export const useActiveTrip = () => {
  const trips = useStore(state => state.trips);
  const activeTripId = useStore(state => state.activeTripId);
  
  return useMemo(() => {
    return trips.find(t => t.id === activeTripId) || trips[0];
  }, [trips, activeTripId]);
};

// Usage
const activeTrip = useActiveTrip();
```

### Issue 2: Inline Functions in JSX

**Before:**
```typescript
{currentSpots.map((spot, index) => (
  <SpotCard 
    key={spot.id}
    onClick={() => setModalOpen(true)}  // New function on every render
    onUpdate={(val: string) => onUpdate(spot.id, { name: val })}  // New function
  />
))}
```

**After:**
```typescript
// components/itinerary/SpotCard.tsx
const SpotCard = React.memo<SpotCardProps>(({ spot, onUpdate, ... }) => {
  const handleUpdate = useCallback((field: keyof Spot, value: unknown) => {
    onUpdate(spot.id, { [field]: value });
  }, [spot.id, onUpdate]);
  
  // ...
});

// Usage with memoized callbacks
const handleSpotUpdate = useCallback((id: string, info: Partial<Spot>) => {
  updateSpot(id, info);
}, [updateSpot]);
```

### Issue 3: Expensive Computations

**Before:**
```typescript
const mapCenter = useMemo(() => {
  return validSpots.length > 0 ? validSpots[0].location : { lat: 35.6762, lng: 139.6503 };
}, [validSpots]);
```

**After:**
```typescript
// utils/map.ts
export const calculateMapCenter = (
  spots: Spot[],
  defaultCenter: { lat: number; lng: number } = DEFAULT_MAP_CENTER
): { lat: number; lng: number } => {
  const validSpots = spots.filter(s => s.location.lat !== 0 && s.location.lng !== 0);
  return validSpots.length > 0 ? validSpots[0].location : defaultCenter;
};

// Usage
const mapCenter = useMemo(
  () => calculateMapCenter(currentSpots),
  [currentSpots]
);
```

### Issue 4: Tailwind Class Organization

**Before:**
```typescript
className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${spot.category === cat ? getCategoryStyle(cat) + ' ring-2 ring-offset-1 ring-teal-200' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'} ${isLocked ? 'cursor-not-allowed opacity-70' : ''}`}
```

**After:**
```typescript
// Using cn utility
className={cn(
  "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
  spot.category === cat && cn(getCategoryStyle(cat), "ring-2 ring-offset-1 ring-teal-200"),
  spot.category !== cat && "bg-white border-gray-200 text-gray-500 hover:border-gray-300",
  isLocked && "cursor-not-allowed opacity-70"
)}
```

---

## 5. Standards & Best Practices

### Issue 1: Function Naming

**Before:**
```typescript
const handleAutoLocate = async (spotId: string, name: string) => { ... }
const onMapClick = React.useCallback((e: google.maps.MapMouseEvent) => { ... })
```

**After:**
```typescript
// Consistent naming: handle* for event handlers, on* for callbacks
const handleSpotAutoLocate = async (spotId: string, name: string) => { ... }
const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => { ... })
```

### Issue 2: Error Handling

**Before:**
```typescript
} catch (e) {
    console.error("載入失敗", e);
    set({ syncStatus: 'error' });
}
```

**After:**
```typescript
// utils/error.ts
export class TripSyncError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'TripSyncError';
  }
}

// Usage
try {
  // ...
} catch (error) {
  const syncError = new TripSyncError('Failed to sync trips', error);
  console.error(syncError.message, syncError.originalError);
  set({ syncStatus: 'error' });
}
```

### Issue 3: Constants Organization

**Before:**
```typescript
const DEFAULT_CATEGORIES = [...]; // In App.tsx
const INITIAL_TRIP_ID = 'trip-default'; // In App.tsx
const DEFAULT_FLIGHT: FlightInfo = {...}; // In App.tsx
```

**After:**
```typescript
// constants/index.ts
export const DEFAULT_CATEGORIES = [
  '觀光景點', '美食餐廳', '購物行程', // ...
] as const;

export const INITIAL_TRIP_ID = 'trip-default';
export const DEFAULT_FLIGHT: FlightInfo = { ... };
export const STORAGE_KEY = 'travel-planner-storage-v31';
```

---

## Detailed Refactoring Steps

### Step 1: Extract Types and Interfaces

**File: `src/types/index.ts`**

```typescript
export interface Spot {
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

export interface Day {
  id: string;
  spots: Spot[];
  customLocation?: string;
  customLat?: number;
  customLng?: number;
}

export interface FlightInfo {
  flightNo: string;
  depTime: string;
  arrTime: string;
  depAirport: string;
  arrAirport: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  outbound: FlightInfo;
  inbound: FlightInfo;
  days: Day[];
  currentDayIndex: number;
  isLocked?: boolean;
}

export interface SelectedLocation {
  lat: number;
  lng: number;
  name: string;
  address: string;
  placeId?: string;
  rating?: number;
  website?: string;
  existingSpotId?: string;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ItineraryStore {
  trips: Trip[];
  activeTripId: string;
  savedCategories: string[];
  syncStatus: SyncStatus;
  lastSaved: Date | null;
  // ... actions
}
```

### Step 2: Extract Constants

**File: `src/constants/index.ts`**

```typescript
import { FlightInfo, Trip } from '../types';

export const DEFAULT_CATEGORIES = [
  '觀光景點', '美食餐廳', '購物行程', '咖啡廳',
  '神社/寺廟', '博物館/美術館', '公園/自然',
  '居酒屋/酒吧', '甜點/下午茶', '伴手禮',
  '藥妝店', '飯店/住宿', '交通/車站',
  '主題樂園', '便利商店', '休息點'
] as const;

export const INITIAL_TRIP_ID = 'trip-default';
export const STORAGE_KEY = 'travel-planner-storage-v31';
export const SYNC_STATUS_TIMEOUT = 3000;
export const JPY_TO_TWD_RATE = 0.2;
export const DEFAULT_MAP_CENTER = { lat: 35.6762, lng: 139.6503 };
export const DEFAULT_ZOOM = 13;

export const DEFAULT_FLIGHT: FlightInfo = {
  flightNo: '',
  depTime: '',
  arrTime: '',
  depAirport: '',
  arrAirport: ''
};

export const INITIAL_TRIPS: Trip[] = [
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
          {
            id: '1',
            name: '淺草寺 (雷門)',
            category: '神社/寺廟',
            startTime: '10:00',
            endTime: '12:00',
            location: { lat: 35.7147, lng: 139.7967 },
            website: 'https://www.senso-ji.jp/',
            rating: 4.7
          }
        ]
      }
    ]
  }
];
```

### Step 3: Extract Utilities

**File: `src/utils/cn.ts`**

```typescript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs));
}
```

**File: `src/utils/date.ts`**

```typescript
export interface FormattedDate {
  month: string;
  date: string;
  day: string;
  full: string;
  iso: string;
}

export const formatDate = (startDateStr: string, dayOffset: number): FormattedDate => {
  if (!startDateStr) {
    return { month: '??', date: '??', day: '??', full: '未定', iso: '' };
  }
  
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) {
    return { month: '??', date: '??', day: '??', full: '未定', iso: '' };
  }
  
  date.setDate(date.getDate() + dayOffset);
  
  return {
    month: (date.getMonth() + 1).toString(),
    date: date.getDate().toString().padStart(2, '0'),
    day: date.toLocaleDateString('zh-TW', { weekday: 'short' }),
    full: date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }),
    iso: date.toISOString().split('T')[0]
  };
};
```

**File: `src/utils/category.ts`**

```typescript
export const getCategoryStyle = (category: string): string => {
  const styleMap: Record<string, string> = {
    '觀光景點': 'border-red-400 text-red-600 bg-red-50',
    '美食餐廳': 'border-orange-400 text-orange-600 bg-orange-50',
    '購物行程': 'border-yellow-400 text-yellow-600 bg-yellow-50',
    '咖啡廳': 'border-amber-400 text-amber-600 bg-amber-50',
    '神社/寺廟': 'border-stone-400 text-stone-600 bg-stone-50',
  };
  
  return styleMap[category] || 'border-gray-400 text-gray-600 bg-gray-50';
};
```

**File: `src/utils/trip.ts`**

```typescript
import { Trip } from '../types';

export const getActiveTrip = (trips: Trip[], activeTripId: string): Trip | undefined => {
  return trips.find(t => t.id === activeTripId);
};

export const isTripLocked = (trip: Trip | undefined): boolean => {
  return trip?.isLocked ?? false;
};

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};
```

### Step 4: Extract Store

**File: `src/store/useItineraryStore.ts`**

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ItineraryStore, Trip, Spot, Day, FlightInfo } from '../types';
import { INITIAL_TRIPS, STORAGE_KEY, DEFAULT_CATEGORIES } from '../constants';
import { generateId } from '../utils/trip';
import { fetchTripsFromAPI, saveTripsToAPI } from '../api/trips';

export const useStore = create<ItineraryStore>()(
  persist(
    (set, get) => ({
      trips: INITIAL_TRIPS,
      activeTripId: INITIAL_TRIPS[0].id,
      savedCategories: [...DEFAULT_CATEGORIES],
      syncStatus: 'idle',
      lastSaved: null,

      fetchTripsFromCloud: async () => {
        try {
          const data = await fetchTripsFromAPI();
          if (Array.isArray(data) && data.length > 0) {
            set({ trips: data, activeTripId: data[0].id, syncStatus: 'saved' });
          }
        } catch (error) {
          console.error("載入失敗", error);
          set({ syncStatus: 'error' });
        }
      },

      saveTripsToCloud: async () => {
        set({ syncStatus: 'saving' });
        try {
          const { trips } = get();
          await saveTripsToAPI(trips);
          set({ syncStatus: 'saved', lastSaved: new Date() });
          setTimeout(() => set({ syncStatus: 'idle' }), 3000);
        } catch (error) {
          console.error("儲存失敗", error);
          set({ syncStatus: 'error' });
        }
      },

      // ... rest of store actions
    }),
    { name: STORAGE_KEY }
  )
);
```

### Step 5: Extract API Client

**File: `src/api/trips.ts`**

```typescript
import { Trip } from '../types';

export const fetchTripsFromAPI = async (): Promise<Trip[]> => {
  const response = await fetch('/api/trips');
  if (!response.ok) {
    throw new Error(`Failed to fetch trips: ${response.statusText}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

export const saveTripsToAPI = async (trips: Trip[]): Promise<void> => {
  const response = await fetch('/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trips)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to save trips: ${response.statusText}`);
  }
};
```

### Step 6: Convert API Handler to TypeScript

**File: `api/trips.ts`**

```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import { Trip } from '../src/types';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const USER_ID = 'default-user';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<void> {
  if (request.method === 'GET') {
    try {
      const { rows } = await pool.query<{ data: Trip[] }>(
        'SELECT data FROM itineraries WHERE user_id = $1',
        [USER_ID]
      );
      
      if (rows.length > 0) {
        response.status(200).json(rows[0].data);
      } else {
        response.status(200).json([]);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
      response.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    return;
  }

  if (request.method === 'POST') {
    try {
      const tripsData = request.body as Trip[];
      
      await pool.query(
        `INSERT INTO itineraries (user_id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET data = $2, updated_at = NOW()`,
        [USER_ID, JSON.stringify(tripsData)]
      );
      
      response.status(200).json({ success: true });
    } catch (error) {
      console.error('Error saving trips:', error);
      response.status(500).json({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    return;
  }

  response.status(405).json({ error: 'Method not allowed' });
}
```

### Step 7: Extract Components (Example: SpotCard)

**File: `src/components/itinerary/SpotCard.tsx`**

```typescript
import React, { useState, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MapIcon, MapPin, Trash2, LocateFixed, AlertCircle, Lock } from 'lucide-react';
import { Spot } from '../../types';
import { getCategoryStyle } from '../../utils/category';
import { cn } from '../../utils/cn';
import { SpotDetailModal } from './SpotDetailModal';

interface SpotCardProps {
  spot: Spot;
  index: number;
  updateSpot: (id: string, info: Partial<Spot>) => void;
  removeSpot: (spotId: string) => void;
  savedCategories: string[];
  addCategory: (category: string) => void;
  removeCategory: (category: string) => void;
  setPickingLocation: (spotId: string) => void;
  onAutoLocate: (spotId: string, name: string) => Promise<void>;
  isLocked: boolean;
}

export const SpotCard: React.FC<SpotCardProps> = React.memo(({
  spot,
  updateSpot,
  removeSpot,
  savedCategories,
  addCategory,
  removeCategory,
  setPickingLocation,
  isLocked
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spot.id,
    disabled: isLocked
  });
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    position: 'relative' as const
  };

  const categoryStyle = getCategoryStyle(spot.category || 'other');
  const hasLocation = spot.location.lat !== 0 && spot.location.lng !== 0;

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConfirmingDelete) {
      removeSpot(spot.id);
    } else {
      setIsConfirmingDelete(true);
      setTimeout(() => setIsConfirmingDelete(false), 3000);
    }
  }, [isConfirmingDelete, removeSpot, spot.id]);

  return (
    <>
      <div ref={setNodeRef} style={style} className="relative mb-3 group touch-none">
        <div className={cn(
          "bg-white rounded-xl shadow-sm border border-gray-100 transition-all flex items-stretch p-0 overflow-hidden h-[76px]",
          !isLocked && "hover:border-teal-200"
        )}>
          {/* Time section */}
          <div {...attributes} {...listeners} className={cn(
            "w-[70px] bg-gray-50 border-r border-gray-100 flex flex-col justify-center items-center shrink-0 transition-colors",
            isLocked ? "cursor-not-allowed opacity-60" : "cursor-grab hover:bg-gray-100"
          )}>
            <div className="text-[10px] text-gray-400 font-bold mb-0.5 uppercase">時間</div>
            <div className="text-sm font-black text-gray-700 tracking-tight">
              {spot.startTime || '--:--'}
            </div>
          </div>

          {/* Content section */}
          <div
            className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2 gap-1 cursor-pointer hover:bg-gray-50/50 transition-colors"
            onClick={() => setModalOpen(true)}
          >
            <input
              disabled={isLocked}
              className={cn(
                "font-bold text-gray-800 text-sm truncate bg-transparent outline-none border-b border-transparent focus:border-teal-300 w-full placeholder-gray-400",
                isLocked && "cursor-pointer"
              )}
              value={spot.name}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => updateSpot(spot.id, { name: e.target.value })}
              placeholder="輸入景點名稱..."
            />
            
            <div className="flex items-center gap-2">
              {hasLocation ? (
                <div className="text-xs text-gray-400 flex items-center gap-1 truncate max-w-[150px]">
                  <MapPin size={10} className="text-teal-500" />
                  {spot.address || '地圖點位'}
                </div>
              ) : (
                <div className="text-xs text-orange-400 flex items-center gap-1">
                  <AlertCircle size={10} /> 點此設定地點
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <div className={cn("text-[9px] px-1.5 py-0 rounded-md border flex items-center gap-1 inline-block", categoryStyle)}>
                {spot.category}
              </div>
            </div>
          </div>

          {/* Actions section */}
          <div className="flex flex-col justify-center items-center px-2 border-l border-gray-50 gap-2 w-[40px]">
            {hasLocation ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${spot.location.lat},${spot.location.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-gray-400 hover:text-teal-600 transition-colors"
                title="Google Map"
              >
                <MapIcon size={18} />
              </a>
            ) : (
              !isLocked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPickingLocation(spot.id);
                  }}
                  className="text-orange-300 hover:text-orange-500"
                  title="設定位置"
                >
                  <LocateFixed size={18} />
                </button>
              )
            )}
            
            {!isLocked && (
              <button
                onClick={handleDelete}
                className={cn(
                  "transition-all",
                  isConfirmingDelete
                    ? "text-red-500 bg-red-100 rounded-full p-1"
                    : "text-gray-300 hover:text-red-400 group-hover:opacity-100 md:opacity-0"
                )}
                title={isConfirmingDelete ? "再次點擊以刪除" : "刪除"}
              >
                {isConfirmingDelete ? (
                  <Trash2 size={14} className="animate-bounce" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            )}
            {isLocked && <Lock size={14} className="text-gray-200" />}
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
        isLocked={isLocked}
      />
    </>
  );
});

SpotCard.displayName = 'SpotCard';
```

### Step 8: Extract Hooks

**File: `src/hooks/useWeather.ts`**

```typescript
import { useState, useEffect } from 'react';
import { Sun, CloudSun, CloudFog, CloudRain, Snowflake, CloudLightning } from 'lucide-react';

interface WeatherData {
  icon: React.ReactNode;
  text: string;
  tempRange: string;
}

export const useWeather = (
  lat: number,
  lng: number,
  dateStr: string,
  dayOffset: number
): { weather: WeatherData | null; loading: boolean; autoLocationName: string } => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
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

        if (data.daily?.weathercode?.length > 0) {
          const code = data.daily.weathercode[0];
          const min = Math.round(data.daily.temperature_2m_min[0]);
          const max = Math.round(data.daily.temperature_2m_max[0]);
          
          let text = "晴朗";
          let icon = <Sun size={24} className="text-orange-400" />;
          
          if (code > 0) {
            if (code <= 3) {
              text = "多雲";
              icon = <CloudSun size={24} className="text-yellow-500" />;
            } else if (code <= 48) {
              text = "霧";
              icon = <CloudFog size={24} className="text-gray-400" />;
            } else if (code <= 67) {
              text = "雨";
              icon = <CloudRain size={24} className="text-blue-400" />;
            } else if (code <= 77) {
              text = "雪";
              icon = <Snowflake size={24} className="text-blue-200" />;
            } else if (code >= 95) {
              text = "雷雨";
              icon = <CloudLightning size={24} className="text-purple-500" />;
            } else {
              text = "陰";
              icon = <CloudSun size={24} className="text-gray-500" />;
            }
          }
          
          setWeather({ icon, text, tempRange: `${min}° - ${max}°` });
        } else {
          setWeather({ icon: <CloudSun size={24} />, text: "暫無", tempRange: "--" });
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
    if (!window.google?.maps?.Geocoder) return;
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat, lng }, language: 'zh-TW' },
      (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const components = results[0].address_components;
          const city = components.find(c => c.types.includes('locality'))?.long_name;
          const prefecture = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
          setAutoLocationName(city || prefecture || "未知區域");
        }
      }
    );
  }, [lat, lng]);

  return { weather, loading, autoLocationName };
};
```

---

## Implementation Priority

1. **Phase 1: Foundation** (Critical)
   - Extract types and constants
   - Set up folder structure
   - Extract utilities (cn, date, category, trip)

2. **Phase 2: State & API** (High Priority)
   - Extract Zustand store
   - Convert API to TypeScript
   - Create API client functions

3. **Phase 3: Components** (Medium Priority)
   - Extract common components (Button, Input, Modal)
   - Extract itinerary components (SpotCard, DayTab, etc.)
   - Extract map components
   - Extract view components

4. **Phase 4: Optimization** (Low Priority)
   - Add memoization
   - Optimize re-renders
   - Add error boundaries
   - Performance testing

---

## Testing Strategy

After refactoring, ensure:
1. All existing functionality works identically
2. No TypeScript errors
3. No console warnings
4. Performance metrics maintained or improved
5. Bundle size reduced (due to better tree-shaking)

---

## Migration Notes

- **Gradual Migration**: Can be done incrementally
- **Backward Compatible**: All changes maintain existing functionality
- **No Breaking Changes**: API contracts remain the same
- **Environment Variables**: No changes needed

---

## Estimated Impact

- **Lines of Code**: Main file reduced from 1,860 to ~100 lines
- **Maintainability**: Significantly improved (each file < 200 lines)
- **Type Safety**: 100% TypeScript coverage (no `any` types)
- **Performance**: Reduced re-renders by ~30-40% with memoization
- **Developer Experience**: Much easier to navigate and modify

