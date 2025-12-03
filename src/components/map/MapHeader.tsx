import React, { useState, useRef } from 'react';
import { Search } from 'lucide-react';
import { Autocomplete } from '@react-google-maps/api';

interface MapHeaderProps {
    onPlacePreview: (place: google.maps.places.PlaceResult) => void;
    onTextSearch: (query: string) => void;
}

export const MapHeader: React.FC<MapHeaderProps> = ({ onPlacePreview, onTextSearch }) => {
    const [inputValue, setInputValue] = useState("");
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
        autocompleteRef.current = autocomplete;
    };

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
                <div className="pl-3 flex items-center pointer-events-none z-20">
                    <Search size={16} className="text-gray-400" />
                </div>

                <div className="flex-1 min-w-0">
                    <Autocomplete
                        onLoad={onLoad}
                        onPlaceChanged={onPlaceChanged}
                        options={{ fields: ["geometry", "name", "formatted_address", "place_id", "rating", "website"] }}
                    >
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

