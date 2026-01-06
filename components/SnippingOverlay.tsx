
import React, { useState } from 'react';
import { X, Scissors } from 'lucide-react';

interface SnippingOverlayProps {
  onCapture: (rect: { x: number, y: number, width: number, height: number }) => void;
  onCancel: () => void;
}

const SnippingOverlay: React.FC<SnippingOverlayProps> = ({ onCapture, onCancel }) => {
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setStartPos({ x: clientX, y: clientY });
    setCurrentPos({ x: clientX, y: clientY });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPos) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setCurrentPos({ x: clientX, y: clientY });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !startPos || !currentPos) return;
    
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(startPos.x - currentPos.x);
    const height = Math.abs(startPos.y - currentPos.y);

    if (width > 10 && height > 10) {
      onCapture({ x, y, width, height });
    }
    
    setIsDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  };

  const getRectStyle = () => {
    if (!startPos || !currentPos) return {};
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(startPos.x - currentPos.x);
    const height = Math.abs(startPos.y - currentPos.y);
    return {
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] cursor-crosshair bg-black/40 select-none touch-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    >
      <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-2xl border border-slate-200 flex items-center gap-4 pointer-events-auto">
        <Scissors size={18} className="text-indigo-600 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">Select area to capture</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {startPos && currentPos && (
        <div 
          className="absolute border-2 border-indigo-500 bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none"
          style={getRectStyle()}
        >
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-indigo-500" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-indigo-500" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-indigo-500" />
        </div>
      )}
    </div>
  );
};

export default SnippingOverlay;
