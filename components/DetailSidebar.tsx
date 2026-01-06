
import React from 'react';
import { X, MapPin, Building2, Layers, ExternalLink, Info } from 'lucide-react';
import { GeoPoint } from '../types';
import { CATEGORY_MAP } from '../constants/mapConfig';

interface DetailSidebarProps {
  point: GeoPoint;
  onClose: () => void;
}

const formatValue = (key: string, value: any) => {
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('appropriation')) {
      return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString();
  }
  return String(value);
};

const DetailSidebar: React.FC<DetailSidebarProps> = ({ point, onClose }) => {
  const config = CATEGORY_MAP[point.category || 'Other'] || CATEGORY_MAP['Other'];
  const dataFields = point.data ? Object.entries(point.data).filter(([k]) => !['type_val', 'X', 'Y', 'Longitude', 'Latitude'].includes(k)) : [];

  return (
    <div className="h-full flex flex-col bg-white text-slate-900 overflow-hidden">
      <div className="relative h-64 flex-shrink-0">
        <img src={`https://picsum.photos/seed/${point.id}/800/600`} alt={point.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent"></div>
        <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center text-slate-800 hover:bg-indigo-600 hover:text-white transition-all z-10 shadow-xl"><X size={20} /></button>
        <div className="absolute bottom-6 left-8 right-8">
          <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-white mb-2 inline-block shadow-lg" style={{ backgroundColor: config.color }}>{point.category}</span>
          <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight drop-shadow-sm">{point.name}</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
        <section>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Info size={14} className="text-indigo-600" />Strategic Summary</h3>
          <p className="text-slate-600 text-xs leading-relaxed font-medium">Critical asset identification for regional development. This facility serves as a primary hub for municipal operations within {point.municipality || 'the designated zone'}.</p>
        </section>
        
        <section className="grid grid-cols-2 gap-4">
           <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
              <MapPin size={16} className="text-indigo-600 mb-3" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Geospatial</p>
              <p className="text-[10px] font-black text-slate-800">{point.lat.toFixed(4)}, {point.lng.toFixed(4)}</p>
           </div>
           <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
              <Building2 size={16} className="text-indigo-600 mb-3" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Administrative</p>
              <p className="text-[10px] font-black text-slate-800 truncate">{point.data?.Province || 'BARMM'}</p>
           </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Layers size={14} className="text-indigo-600" />Dataset Matrix</h3>
          <div className="space-y-2">
            {dataFields.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight truncate mr-4">{key}</span>
                <span className="text-[10px] font-black text-slate-800">{formatValue(key, value)}</span>
              </div>
            ))}
          </div>
        </section>
        
        <div className="pt-4">
          <button className="w-full bg-slate-900 text-white py-4 rounded-[28px] font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200">
            <ExternalLink size={16} /> Advanced Analytics
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailSidebar;
