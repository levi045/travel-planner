import type { Spot } from '../types';
import { DEFAULT_MAP_CENTER } from '../constants';

export const calculateMapCenter = (
    spots: Spot[],
    defaultCenter: { lat: number; lng: number } = DEFAULT_MAP_CENTER
): { lat: number; lng: number } => {
    const validSpots = spots.filter(s => s.location.lat !== 0 && s.location.lng !== 0);
    return validSpots.length > 0 ? validSpots[0].location : defaultCenter;
};

