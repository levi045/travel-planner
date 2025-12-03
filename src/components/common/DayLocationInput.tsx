import React, { useRef } from 'react';
import { Autocomplete } from '@react-google-maps/api';

interface DayLocationInputProps {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
    onLocationSelect: (lat: number, lng: number, name: string) => void;
    disabled?: boolean;
}

export const DayLocationInput: React.FC<DayLocationInputProps> = ({
    value,
    placeholder,
    onChange,
    onLocationSelect,
    disabled
}) => {
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
        autocompleteRef.current = autocomplete;
    };

    const onPlaceChanged = () => {
        if (autocompleteRef.current) {
            const place = autocompleteRef.current.getPlace();
            if (!place?.geometry?.location) return;
            onLocationSelect(
                place.geometry.location.lat(),
                place.geometry.location.lng(),
                place.name || ""
            );
        }
    };

    if (disabled) {
        return (
            <input
                disabled
                className="bg-transparent outline-none w-full text-gray-400 font-medium cursor-not-allowed"
                value={value}
            />
        );
    }

    return (
        <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged} types={['(regions)']}>
            <input
                className="bg-transparent outline-none w-full text-gray-600 font-medium placeholder-gray-300"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </Autocomplete>
    );
};

