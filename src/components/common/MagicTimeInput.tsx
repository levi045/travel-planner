import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';

interface MagicTimeInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const MagicTimeInput: React.FC<MagicTimeInputProps> = ({
    value,
    onChange,
    placeholder,
    className,
    disabled
}) => {
    const [tempValue, setTempValue] = useState(value);

    useEffect(() => setTempValue(value), [value]);

    const handleBlur = () => {
        if (disabled) return;
        let clean = tempValue.replace(/\D/g, '');
        if (!clean) return;

        let formatted = clean;

        if (clean.length === 1) {
            formatted = `0${clean}:00`;
        } else if (clean.length === 2) {
            formatted = `${clean}:00`;
        } else if (clean.length === 3) {
            formatted = `${clean.substring(0, 2)}:${clean.substring(2)}0`;
        } else if (clean.length >= 4) {
            formatted = `${clean.substring(0, 2)}:${clean.substring(2, 4)}`;
        }

        if (formatted.includes(':')) {
            let [h, m] = formatted.split(':').map(Number);
            if (h > 23) h = 23;
            if (m > 59) m = 59;
            formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        onChange(formatted);
        setTempValue(formatted);
    };

    return (
        <input
            type="text"
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
                className,
                disabled && "bg-gray-100 cursor-not-allowed text-gray-400"
            )}
            value={tempValue || ''}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
    );
};

