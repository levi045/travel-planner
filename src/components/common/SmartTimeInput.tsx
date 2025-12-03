import React from 'react';
import { cn } from '../../utils/cn';

interface SmartTimeInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export const SmartTimeInput: React.FC<SmartTimeInputProps> = ({
    value,
    onChange,
    placeholder,
    className,
    disabled
}) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <input
            disabled={disabled}
            type="text"
            placeholder={placeholder}
            className={cn(
                className,
                disabled && "bg-gray-100 cursor-not-allowed text-gray-400"
            )}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
        />
    );
};

