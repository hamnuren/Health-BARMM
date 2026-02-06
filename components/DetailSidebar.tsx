
import React, { useMemo } from 'react';
import { X, MapPin, Building2, Layers, ExternalLink, Info, Coins, ClipboardList, TrendingUp } from 'lucide-react';
import { GeoPoint } from '../types';
import { CATEGORY_MAP } from '../constants/mapConfig';

interface DetailSidebarProps {
  point: GeoPoint;
  onClose: () => void;
}

const formatCurrency = (value: any) => {
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (isNaN(num)) return '0.00';
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Normalizes accomplishment values to a display string and a percentage number.
 * Handles strings like "100%", "95.00" and decimals like 1.0 or 0.95 from Excel.
 */
const parseAccomplishment = (value: any): { display: string; percent: string } => {
  if (value === null || value === undefined || value === '') {
    return { display: '0%', percent: '0%' };
  }

  // Handle numeric values (often from Excel: 1 = 100%, 0.95 = 95%)
  if (typeof value === 'number') {
    // If value is between 0 and 1 (exclusive of 0), it's likely a decimal fraction
    if (value > 0 && value <= 1) {
      const p = value * 100;
      return { 
        display: `${p % 1 === 0 ? p : p.toFixed(2)}%`, 
        percent: `${p}%` 
      };
    }
    // Otherwise assume it's already on a 0-100 scale
    return { display: `${value}%`, percent: `${value}%` };
  }

  // Handle string values
  const strValue = String(value).trim();
  if (strValue.includes('%')) {
    return { display: strValue, percent: strValue };
  }

  // Try parsing string as number (e.g., "95.00")
  const num = parseFloat(strValue);
  if (!isNaN(num)) {
    // If it's a string like "0.95", treat as fraction
    if (num > 0 && num <= 1 && !strValue.includes('.') === false) {
       const p = num * 100;
       return { display: `${p % 1 === 0 ? p : p.toFixed(2)}%`, percent: `${p}%` };
    }
    return { display: `${num}%`, percent: `${num}%` };
  }

  return { display: strValue, percent: strValue };
};

const DetailSidebar: React.FC<DetailSidebarProps> = ({ point, onClose }) => {
  const facilities = point.facilities || [point];
  
  // Group facilities by Source of Fund
  const groupedFacilities = useMemo(() => {
    const groups: Record<string, GeoPoint[]> = {};
    facilities.forEach(f => {
      const fund = (f.data?.['Source of Fund'] || f.data?.source_of_fund || 'GENERAL FUND').toString();
      if (!groups[fund]) groups[fund] = [];
      groups[fund].push(f);
    });
    return groups;
  }, [facilities]);

  // Calculate unique categories for the header summary
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    facilities.forEach(f => {
      const cat = f.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [facilities]);

  const totalApprop = useMemo(() => {
    return facilities.reduce((sum, f) => {
      const val = f.data?.Appropriation || f.data?.appropriation || 0;
      const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);
  }, [facilities]);

  const primaryCategory = point.category || 'Other';
  const headerConfig = CATEGORY_MAP[primaryCategory] || CATEGORY_MAP['Other'];

  // Identify the shortest name to use as a "Base Identity" for the header
  const baseDisplayName = useMemo(() => {
    if (facilities.length === 1) return point.name;
    return facilities.reduce((shortest, f) => f.name.length < shortest.length ? f.name : shortest, facilities[0].name);
  }, [facilities, point.name]);

  return (
    <div className="h-full flex flex-col bg-white text-slate-900 overflow-hidden">
      {/* Header Area */}
      <div className="relative h-64 flex-shrink-0">
        <img 
          src={`https://picsum.photos/seed/${point.id}/800/600`} 
          alt={baseDisplayName} 
          className="w-full h-full object-cover brightness-90" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent"></div>
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 w-10 h-10 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/40 flex items-center justify-center text-slate-800 hover:bg-red-500 hover:text-white transition-all z-10 shadow-xl"
        >
          <X size={20} />
        </button>
        <div className="absolute bottom-6 left-8 right-8">
          <div className="flex flex-wrap gap-2 mb-2">
            {(Object.entries(categoryCounts) as [string, number][]).map(([cat, count]) => {
              const cfg = CATEGORY_MAP[cat] || CATEGORY_MAP['Other'];
              return (
                <span 
                  key={cat}
                  className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-lg flex items-center gap-1.5" 
                  style={{ backgroundColor: cfg.color }}
                >
                  {cat}
                </span>
              );
            })}
            {facilities.length > 1 && (
              <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-900 text-white shadow-lg">
                Consolidated View ({facilities.length})
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-900 leading-tight tracking-tight uppercase">
            {baseDisplayName}
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {point.municipality || point.data?.Municipality || 'BARMM'} Location Hub
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
        {/* Core Metrics */}
        <section className="grid grid-cols-2 gap-4">
           <div className="p-4 bg-slate-50 rounded-[28px] border border-slate-100 shadow-sm group hover:bg-white hover:shadow-md transition-all">
              <MapPin size={16} className="text-indigo-600 mb-3" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Geospatial Index</p>
              <p className="text-[10px] font-black text-slate-800">{point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
           </div>
           <div className="p-4 bg-slate-50 rounded-[28px] border border-slate-100 shadow-sm group hover:bg-white hover:shadow-md transition-all">
              <Coins size={16} className="text-emerald-600 mb-3" />
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Appropriation</p>
              <p className="text-[10px] font-black text-slate-800">₱{formatCurrency(totalApprop)}</p>
           </div>
        </section>

        {/* Clustered Facility List */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ClipboardList size={14} className="text-indigo-600" /> Facility Project Matrix
            </h3>
            <span className="text-[9px] font-black text-slate-400">{facilities.length} Projects Consolidated</span>
          </div>

          <div className="space-y-8">
            {(Object.entries(groupedFacilities) as [string, GeoPoint[]][]).map(([fund, items]) => (
              <div key={fund} className="space-y-4">
                {/* Source of Fund Header */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-100"></div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-200 shadow-sm">
                    {fund}
                  </span>
                  <div className="h-px flex-1 bg-slate-100"></div>
                </div>

                <div className="space-y-4">
                  {items.map((facility, idx) => {
                    const rawValue = facility.data?.['Physical Accomplishment (%)'] || facility.data?.accomplishment || '0%';
                    const { display: displayAcc, percent: percentWidth } = parseAccomplishment(rawValue);
                    const approp = facility.data?.Appropriation || facility.data?.appropriation || 0;
                    const cat = facility.category || 'Other';
                    const catCfg = CATEGORY_MAP[cat] || CATEGORY_MAP['Other'];
                    
                    return (
                      <div key={`${fund}-${idx}`} className="p-5 bg-white border border-slate-100 rounded-[24px] hover:border-indigo-200 hover:shadow-xl transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 pr-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span 
                                className="px-2 py-0.5 rounded text-[8px] font-black uppercase text-white"
                                style={{ backgroundColor: catCfg.color }}
                              >
                                {cat}
                              </span>
                            </div>
                            <h4 className="text-[11px] font-black text-slate-800 uppercase leading-snug mb-1 group-hover:text-indigo-600 transition-colors">
                              {facility.name}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              {facility.data?.['Project Type'] || 'General Infrastructure'}
                            </p>
                          </div>
                          <div className="text-right">
                             <span className="text-[10px] font-black text-emerald-600">₱{formatCurrency(approp)}</span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-[9px] font-bold text-slate-500 italic leading-relaxed">
                              {facility.data?.['Project Description'] || 'No additional project description available for this phase.'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <TrendingUp size={12} className="text-indigo-500" />
                              <span className="text-[9px] font-black text-slate-600 uppercase">Accomplishment</span>
                            </div>
                            <span className="text-[10px] font-black text-indigo-600">{displayAcc}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full transition-all duration-1000" 
                              style={{ width: percentWidth }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="pt-6">
          <button className="w-full bg-slate-900 text-white py-4 rounded-[28px] font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 active:scale-95">
            <ExternalLink size={16} /> Regional Planning Portal
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailSidebar;
