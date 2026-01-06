
import React, { useState } from 'react';
import { Eye, EyeOff, Map as MapIcon, MinusSquare, PlusSquare } from 'lucide-react';
import { BARMM_PROVINCES } from '../constants/provinces';

interface ProvinceViewControlProps {
  provinces: string[];
  hiddenProvinces: Set<string>;
  onToggle: (name: string) => void;
  onFocusProvince: (name: string) => void;
  highlightedProvince: string | null;
}

const ProvinceViewControl: React.FC<ProvinceViewControlProps> = ({ 
  provinces, hiddenProvinces, onToggle, onFocusProvince,
  highlightedProvince
}) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (provinces.length === 0) return null;

  return (
    <div className="absolute top-6 right-6 z-20 pointer-events-auto exclude-from-screenshot">
      <div className={`transition-all duration-300 ease-in-out bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl overflow-hidden ${isMinimized ? 'w-10 h-10 rounded-full' : 'w-56 rounded-2xl'}`}>
        
        <div className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none transition-colors hover:bg-slate-50 ${isMinimized ? 'h-full justify-center p-0' : 'border-b border-slate-100'}`} onClick={() => setIsMinimized(!isMinimized)}>
          {!isMinimized && (
            <div className="flex items-center gap-2">
              <MapIcon size={14} className="text-indigo-600" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-700">Explorer</span>
            </div>
          )}
          {isMinimized ? (
            <PlusSquare size={16} className="text-indigo-600" />
          ) : (
            <MinusSquare size={14} className="text-slate-400 hover:text-indigo-600 transition-colors" />
          )}
        </div>

        {!isMinimized && (
          <div className="max-h-[350px] overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {provinces.map(name => {
              if (!name) return null;
              const upperName = name.toUpperCase();
              const isHidden = hiddenProvinces.has(upperName);
              const hProv = (highlightedProvince || '').toUpperCase();
              const isHighlighted = highlightedProvince && (upperName.includes(hProv) || hProv.includes(upperName));
              
              const displayLabel = upperName.includes("SPECIAL GEOGRAPHIC AREA") ? "SGA" : name;

              const provinceConfig = BARMM_PROVINCES.find(p => {
                if (!p.name) return false;
                const pUpper = p.name.toUpperCase();
                return upperName.includes(pUpper) || pUpper.includes(upperName) || (pUpper === 'SGA' && upperName.includes('SPECIAL GEOGRAPHIC AREA'));
              });
              
              return (
                <div key={name} className="space-y-0.5">
                  <div className={`flex items-center gap-1 group rounded-xl transition-all duration-300 ${isHighlighted ? 'bg-indigo-50/80 ring-1 ring-indigo-200 shadow-[0_0_12px_rgba(79,70,229,0.15)]' : 'hover:bg-white hover:shadow-md hover:ring-1 hover:ring-slate-100'}`}>
                    <button
                      onClick={() => onFocusProvince(name)}
                      className={`flex-1 flex items-center justify-between p-2.5 transition-all ${isHidden ? 'opacity-40 grayscale' : 'group-hover:brightness-110'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-1 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: provinceConfig?.color || '#cbd5e1' }} />
                        <span className={`text-[9px] font-black uppercase truncate max-w-[120px] transition-colors ${isHidden ? 'text-slate-400' : 'text-slate-800 group-hover:text-indigo-600'}`}>
                          {displayLabel}
                        </span>
                      </div>
                    </button>
                    
                    <div className="flex items-center pr-1.5">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggle(name); }}
                        className={`p-1.5 rounded-lg hover:bg-slate-50 transition-all ${isHidden ? 'text-slate-300' : 'text-indigo-600 hover:scale-110 hover:shadow-sm'}`}
                        title={isHidden ? "Show points" : "Hide points"}
                      >
                        {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProvinceViewControl;
