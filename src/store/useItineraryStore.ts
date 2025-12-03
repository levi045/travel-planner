import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import type { ItineraryStore, Trip, Spot } from '../types';
import { INITIAL_TRIPS, STORAGE_KEY, DEFAULT_CATEGORIES, DEFAULT_FLIGHT } from '../constants';
import { generateId, getActiveTrip, isTripLocked } from '../utils/trip';
import { fetchTripsFromAPI, saveTripsToAPI } from '../api/trips';
import { SYNC_STATUS_TIMEOUT } from '../constants';

// Custom storage with error handling for corrupted localStorage
const safeStorage = {
    getItem: (name: string): string | null => {
        try {
            const item = localStorage.getItem(name);
            if (!item) return null;
            // Try to parse to validate it's valid JSON
            JSON.parse(item);
            return item;
        } catch (error) {
            console.warn(`Corrupted localStorage data detected for "${name}". Clearing...`, error);
            localStorage.removeItem(name);
            return null;
        }
    },
    setItem: (name: string, value: string): void => {
        try {
            localStorage.setItem(name, value);
        } catch (error) {
            console.error(`Failed to save to localStorage:`, error);
        }
    },
    removeItem: (name: string): void => {
        try {
            localStorage.removeItem(name);
        } catch (error) {
            console.error(`Failed to remove from localStorage:`, error);
        }
    }
};

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
                    } else {
                        // In dev mode, API returns empty array, so we keep local state
                        set({ syncStatus: 'idle' });
                    }
                } catch (e) {
                    // Silently fail in dev mode, show error in production
                    if (!import.meta.env.DEV) {
                        console.error("載入失敗", e);
                        set({ syncStatus: 'error' });
                    } else {
                        set({ syncStatus: 'idle' });
                    }
                }
            },

            saveTripsToCloud: async () => {
                set({ syncStatus: 'saving' });
                try {
                    const { trips } = get();
                    await saveTripsToAPI(trips);
                    set({ syncStatus: 'saved', lastSaved: new Date() });
                    setTimeout(() => set({ syncStatus: 'idle' }), SYNC_STATUS_TIMEOUT);
                } catch (e) {
                    // Silently fail in dev mode, show error in production
                    if (!import.meta.env.DEV) {
                        console.error("儲存失敗", e);
                        set({ syncStatus: 'error' });
                    } else {
                        // In dev mode, just reset to idle since API isn't available
                        set({ syncStatus: 'idle' });
                    }
                }
            },

            toggleTripLock: (id) => set((state) => ({
                trips: state.trips.map(t => t.id === id ? { ...t, isLocked: !t.isLocked } : t)
            })),

            createTrip: () => {
                const newId = generateId();
                set((state) => {
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
                });
                return newId;
            },

            switchTrip: (id) => set({ activeTripId: id }),

            deleteTrip: (id) => set((state) => {
                if (state.trips.length <= 1) return state;
                const newTrips = state.trips.filter(t => t.id !== id);
                return { trips: newTrips, activeTripId: state.activeTripId === id ? newTrips[0].id : state.activeTripId };
            }),

            updateTripInfo: (info) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return { trips: state.trips.map(t => t.id === state.activeTripId ? { ...t, ...info } : t) };
            }),

            updateTripDates: (startDate, endDate) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (!trip || isTripLocked(trip)) return state;

                const start = new Date(startDate);
                const end = new Date(endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                if (isNaN(diffDays) || diffDays < 1) return state;

                let newDays = [...trip.days];

                if (diffDays > trip.days.length) {
                    for (let i = 0; i < (diffDays - trip.days.length); i++) {
                        newDays.push({ id: generateId(), spots: [] });
                    }
                } else if (diffDays < trip.days.length) {
                    newDays = newDays.slice(0, diffDays);
                }

                const newCurrentDayIndex = trip.currentDayIndex >= newDays.length ? newDays.length - 1 : trip.currentDayIndex;

                return {
                    trips: state.trips.map(t => t.id === state.activeTripId ? {
                        ...t, startDate: startDate, days: newDays, currentDayIndex: newCurrentDayIndex
                    } : t)
                };
            }),

            updateFlight: (type, info) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
                    trips: state.trips.map(t => {
                        if (t.id !== state.activeTripId) return t;
                        return { ...t, [type]: { ...t[type], ...info } };
                    })
                };
            }),

            setCurrentDayIndex: (index) => set((state) => ({
                trips: state.trips.map(t => t.id === state.activeTripId ? { ...t, currentDayIndex: index } : t)
            })),

            addDay: () => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
                    trips: state.trips.map(t => {
                        if (t.id !== state.activeTripId) return t;
                        const newDays = [...t.days, { id: generateId(), spots: [] }];
                        return { ...t, days: newDays, currentDayIndex: newDays.length - 1 };
                    })
                };
            }),

            deleteDay: (index) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
                    trips: state.trips.map(t => {
                        if (t.id !== state.activeTripId) return t;
                        if (t.days.length <= 1) return t;
                        const newDays = t.days.filter((_, i) => i !== index);
                        const newIndex = t.currentDayIndex >= newDays.length ? newDays.length - 1 : t.currentDayIndex;
                        return { ...t, days: newDays, currentDayIndex: newIndex };
                    })
                };
            }),

            reorderDays: (oldIndex, newIndex) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
                    trips: state.trips.map(t => {
                        if (t.id !== state.activeTripId) return t;
                        const newDays = arrayMove(t.days, oldIndex, newIndex);
                        return { ...t, days: newDays };
                    })
                };
            }),

            updateDayInfo: (dayIndex, info) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
                    trips: state.trips.map(t => {
                        if (t.id !== state.activeTripId) return t;
                        const newDays = [...t.days];
                        if (newDays[dayIndex]) {
                            newDays[dayIndex] = { ...newDays[dayIndex], ...info };
                        }
                        return { ...t, days: newDays };
                    })
                };
            }),

            addSpot: (spotData) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
                    trips: state.trips.map(t => {
                        if (t.id !== state.activeTripId) return t;
                        const currentDay = t.days[t.currentDayIndex];
                        if (!currentDay) return t;
                        const newSpot: Spot = { ...spotData, id: generateId(), category: '觀光景點', startTime: '', endTime: '' };
                        const newDays = [...t.days];
                        newDays[t.currentDayIndex] = { ...currentDay, spots: [...currentDay.spots, newSpot] };
                        return { ...t, days: newDays };
                    })
                };
            }),

            addEmptySpot: () => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
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
                };
            }),

            removeSpot: (spotId) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
                    trips: state.trips.map(t => {
                        if (t.id !== state.activeTripId) return t;
                        const currentDay = t.days[t.currentDayIndex];
                        const newDays = [...t.days];
                        newDays[t.currentDayIndex] = { ...currentDay, spots: currentDay.spots.filter(s => s.id !== spotId) };
                        return { ...t, days: newDays };
                    })
                };
            }),

            reorderSpots: (activeId, overId) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
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
                };
            }),

            updateSpot: (id, info) => set((state) => {
                const trip = getActiveTrip(state.trips, state.activeTripId);
                if (isTripLocked(trip)) return state;
                return {
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
                };
            }),

            addCategory: (category) => set((state) => {
                if (state.savedCategories.includes(category)) return state;
                return { savedCategories: [...state.savedCategories, category] };
            }),

            removeCategory: (category) => set((state) => ({
                savedCategories: state.savedCategories.filter(c => c !== category)
            })),

            importData: (newTrips) => set(() => ({
                trips: newTrips,
                activeTripId: newTrips.length > 0 ? newTrips[0].id : INITIAL_TRIPS[0].id
            }))
        }),
        {
            name: STORAGE_KEY,
            storage: createJSONStorage(() => safeStorage)
        }
    )
);

