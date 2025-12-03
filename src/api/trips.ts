import type { Trip } from '../types';

const isDev = import.meta.env.DEV;

export const fetchTripsFromAPI = async (): Promise<Trip[]> => {
    if (isDev) {
        // In dev mode, API is not available (Vercel serverless functions only work in production)
        // Return empty array to use local storage instead
        return [];
    }

    try {
        const response = await fetch('/api/trips');
        if (!response.ok) {
            throw new Error(`Failed to fetch trips: ${response.statusText}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Failed to fetch trips from API:', error);
        throw error;
    }
};

export const saveTripsToAPI = async (trips: Trip[]): Promise<void> => {
    if (isDev) {
        // In dev mode, API is not available (Vercel serverless functions only work in production)
        // Silently succeed to avoid errors
        return;
    }

    try {
        const response = await fetch('/api/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trips)
        });

        if (!response.ok) {
            throw new Error(`Failed to save trips: ${response.statusText}`);
        }
    } catch (error) {
        console.error('Failed to save trips to API:', error);
        throw error;
    }
};

