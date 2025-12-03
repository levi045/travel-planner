import React from 'react';
import { cn } from '../../utils/cn';

interface ResizeHandleProps {
    onMouseDown: () => void;
    onDoubleClick: () => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ onMouseDown, onDoubleClick }) => {
    return (
        <div
            className={cn(
                "hidden md:flex w-2 bg-gray-100 hover:bg-teal-400 cursor-col-resize items-center justify-center z-50 transition-colors relative group"
            )}
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
        >
            <div className="h-8 w-[2px] bg-gray-300 rounded-full group-hover:bg-white transition-colors" />
        </div>
    );
};

