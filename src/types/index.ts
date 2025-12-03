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

    // Actions
    fetchTripsFromCloud: () => Promise<void>;
    saveTripsToCloud: () => Promise<void>;
    toggleTripLock: (id: string) => void;
    createTrip: () => string;
    switchTrip: (id: string) => void;
    deleteTrip: (id: string) => void;
    updateTripInfo: (info: Partial<Trip>) => void;
    updateTripDates: (startDate: string, endDate: string) => void;
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

