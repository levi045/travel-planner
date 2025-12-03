const FLIGHT_API_KEY = import.meta.env.VITE_AVIATION_KEY || "";

export interface FlightData {
    depTime: string;
    arrTime: string;
    depAirport: string;
    arrAirport: string;
}

export const fetchFlightData = async (flightNo: string): Promise<FlightData | null> => {
    if (!flightNo) return null;

    try {
        if (FLIGHT_API_KEY) {
            const response = await fetch(`http://api.aviationstack.com/v1/flights?access_key=${FLIGHT_API_KEY}&flight_iata=${flightNo}`);
            const data = await response.json();

            if (data?.data?.length > 0) {
                const flight = data.data[0];
                return {
                    depTime: flight.departure.scheduled
                        ? new Date(flight.departure.scheduled).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                        : '--:--',
                    arrTime: flight.arrival.scheduled
                        ? new Date(flight.arrival.scheduled).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                        : '--:--',
                    depAirport: flight.departure.iata || '',
                    arrAirport: flight.arrival.iata || ''
                };
            }
        }
    } catch (error) {
        console.error("Flight API Error:", error);
    }

    // Fallback mock data
    return new Promise<FlightData | null>((resolve) => {
        setTimeout(() => {
            const cleanNo = flightNo.trim().toUpperCase();
            if (cleanNo.includes('BR')) {
                resolve({ depTime: '08:50', arrTime: '13:15', depAirport: 'TPE T2', arrAirport: 'NRT T1' });
            } else if (cleanNo.includes('JX')) {
                resolve({ depTime: '10:30', arrTime: '14:45', depAirport: 'TPE T1', arrAirport: 'KIX T1' });
            } else {
                resolve({ depTime: '10:00', arrTime: '14:00', depAirport: 'TPE', arrAirport: 'NRT' });
            }
        }, 600);
    });
};

