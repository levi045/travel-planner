import type { Trip } from '../types';

export const getActiveTrip = (trips: Trip[], activeTripId: string): Trip | undefined => {
    return trips.find(t => t.id === activeTripId);
};

export const isTripLocked = (trip: Trip | undefined): boolean => {
    return trip?.isLocked ?? false;
};

export const generateId = (): string => {
    return Math.random().toString(36).substr(2, 9);
};

