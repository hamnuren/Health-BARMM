
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, Trash2, MapPin, Search, MapPinned, Globe, Cloud, Navigation2, 
  Moon, Square, Type, Info, Filter, LayoutGrid, Download, FileImage, 
  FileText, Camera, Loader2, Sparkles, ChevronRight, ChevronDown, Building2, 
  Network, Landmark, Activity, X, Scissors, Crosshair, Target, Maximize2,
  CheckCircle2, AlertCircle, AlertTriangle, Eye, EyeOff, Maximize, Map as MapIcon,
  ListFilter, RotateCcw, Box, LibraryBig, ArrowLeft, Coins, Settings2, Layers2,
  Image as ImageIcon, Share2, Tag
} from 'lucide-react';
import { GeoPoint, BaseLayerType } from '../types';
import * as XLSX from 'xlsx';
import { CATEGORY_MAP } from '../constants/mapConfig';

const cleanFacilityName = (name: string): string => {
  if (!name) return 'Unknown Facility';
  let n = name.toUpperCase().trim();
  
  if (n.includes('TAWI-TAWI PROVINCIAL HOSPITAL')) {
    return 'DATU HALUN SAKILAN MEMORIAL HOSPITAL';
  }

  n = n.split(' - ')[0].split(',')[0].split('(')[0].split('/')[0].trim();
  
  const noise = [
    /CONSTRUCTION OF/g, /REPAIR OF/g, /NEW CONSTRUCTION/g, /EXPANSION OF/g, 
    /EQUIPPING OF/g, /REPAIR\/RENOVATION/g, /PHASE \d+/g, /UPGRADE OF/g,
    /REHABILITATION OF/g, /COMPLETION OF/g, /ESTABLISHMENT OF/g,
    /INTEGRATED PROVINCIAL HEALTH OFFICE/g, /CITY HEALTH OFFICE/g,
    /RURAL HEALTH UNIT/g, /BARANGAY HEALTH STATION/g
  ];
  noise.forEach(pattern => { n = n.replace(pattern, '').trim(); });

  if (n.includes('HOSPITAL')) {
    n = n.replace(/SR\.|JR\.|SENIOR|JUNIOR/g, '');
    n = n.replace(/\b[A-Z]\.\s+/g, ' '); 
    n = n.replace(/\s+/g, ' ').trim();
  }
  
  return n.replace(/\s+/g, ' ').trim();
};

interface NavigationProps {
  onDataUpload: (points: GeoPoint[]) => void;
  onClear: () => void;
  onSearch: (lat: number, lng: number) => void;
  onProvinceSelect: (name: string | null) => void;
  onMunicipalitySelect: (name: string | null) => void;
  points: GeoPoint[];
  highlightedProvince: string | null;
  highlightedMunicipality: string | null;
  showMarkers: boolean;
  setShowMarkers: (v: boolean) => void;
  showProvinces: boolean;
  setShowProvinces: (v: boolean) => void;
  showLabels: boolean;
  setShowLabels: (v: boolean) => void;
  showBorders: boolean;
  setShowBorders: (v: boolean) => void;
  showNameMarkers: boolean;
  setShowNameMarkers: (v: boolean) => void;
  availableCategories: string[];
  selectedCategories: string[];
  setSelectedCategories: (cats: string[]) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  baseLayer: BaseLayerType;
  setBaseLayer: (layer: BaseLayerType) => void;
  hiddenProvinces: Set<string>;
  onToggleProvince: (name: string) => void;
  onToggleAllProvinces: (visible: boolean) => void;
  onFitActive: () => void;
  provincesInData: string[];
  onStartSnip: () => void;
  onCaptureFull: (format: 'png' | 'pdf') => void;
  isCapturing: boolean;
  activeTab: string | null;
  setActiveTab: (tab: string | null) => void;
  lastSnapUrl?: string | null;
  onGenerateSnap: () => void;
  denominators?: { muns: number, brgys: number };
  categoryTotals?: Record<string, number>;
}

const AppNavigation: React.FC<NavigationProps> = (props) => {
  const [uploadFeedback, setUploadFeedback] = useState<{
    status: 'idle' | 'processing' | 'success' | 'error';
    message?: string;
    invalidRows?: string[];
    successCount?: number;
  }>({ status: 'idle' });
  const sidebarRef = useRef<HTMLDivElement>(null);

  const hierarchyData = useMemo(() => {
    const hierarchy: any = {};
    let totalInvestment = 0;
    const provFacilities = new Map<string, Set<string>>();
    const munFacilities = new Map<string, Set<string>>();
    const brgyFacilities = new Map<string, Set<string>>();

    props.points.forEach(p => {
      const prov = (p.data?.Province || p.data?.province || 'Unknown').toString();
      const mun = (p.municipality || p.data?.Municipality || 'Unknown').toString();
      const brgy = (p.data?.['Brgy/ Sitio'] || p.data?.Barangay || 'Unknown').toString();
      const appropValue = p.data?.Appropriation || p.data?.appropriation || '0';
      const approp = parseFloat(String(appropValue).replace(/,/g, ''));
      
      const facilityBaseName = cleanFacilityName(p.name);
      const facilityFingerprint = `${facilityBaseName}|${p.category}|${mun}|${prov}`;

      if (!hierarchy[prov]) hierarchy[prov] = { muns: {}, count: 0, investment: 0 };
      if (!hierarchy[prov].muns[mun]) hierarchy[prov].muns[mun] = { brgys: {}, count: 0, investment: 0 };
      if (!hierarchy[prov].muns[mun].brgys[brgy]) hierarchy[prov].muns[mun].brgys[brgy] = { count: 0, investment: 0 };
      
      if (!provFacilities.has(prov)) provFacilities.set(prov, new Set());
      const munKey = `${prov}|${mun}`;
      if (!munFacilities.has(munKey)) munFacilities.set(munKey, new Set());
      const brgyKey = `${prov}|${mun}|${brgy}`;
      if (!brgyFacilities.has(brgyKey)) brgyFacilities.set(brgyKey, new Set());
      
      provFacilities.get(prov)!.add(facilityFingerprint);
      munFacilities.get(munKey)!.add(facilityFingerprint);
      brgyFacilities.get(brgyKey)!.add(facilityFingerprint);
      
      if (!isNaN(approp)) {
        hierarchy[prov].investment += approp;
        hierarchy[prov].muns[mun].investment += approp;
        hierarchy[prov].muns[mun].brgys[brgy].investment += approp;
        totalInvestment += approp;
      }
    });

    Object.keys(hierarchy).forEach(prov => {
      hierarchy[prov].count = provFacilities.get(prov)?.size || 0;
      Object.keys(hierarchy[prov].muns).forEach(mun => {
        const munKey = `${prov}|${mun}`;
        hierarchy[prov].muns[mun].count = munFacilities.get(munKey)?.size || 0;
        Object.keys(hierarchy[prov].muns[mun].brgys).forEach(brgy => {
          const brgyKey = `${prov}|${mun}|${brgy}`;
          hierarchy[prov].muns[mun].brgys[brgy].count = brgyFacilities.get(brgyKey)?.size || 0;
        });
      });
    });
    return { hierarchy, totalInvestment };
  }, [props.points]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFeedback({ status: 'processing', message: 'Parsing regional matrix...' });
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const newPoints = jsonData.map((r: any, i): GeoPoint | null => {
          const lat = parseFloat(r.Latitude || r.latitude || r.LAT || r.lat || r.Y);
          const lng = parseFloat(r.Longitude || r.longitude || r.X || r.long);
          if (isNaN(lat) || isNaN(lng)) return null;
          return {
            id: `up-${Date.now()}-${i}`,
            lat, lng, name: r.Name || r['Name of Facility'] || `Point ${i + 1}`,
            category: r.Category || r['Facility type'] || 'Other',
            municipality: r.Municipality || '',
            data: r
          };
        }).filter((p): p is GeoPoint => p !== null);
        props.onDataUpload(newPoints);
        setUploadFeedback({ status: 'success', successCount: newPoints.length });
      } catch (err) { setUploadFeedback({ status: 'error', message: 'Integrity failure.' }); }
    };
    reader.readAsArrayBuffer(file);
  };

  const isDarkBase = props.baseLayer === 'dark' || props.baseLayer === 'satellite' || props.baseLayer === 'hybrid';

  return (
    <div className="hidden md:flex absolute inset-y-6 left-6 z-50 pointer-events-none items-start exclude-from-screenshot">
      <div className={`w-[76px] backdrop-blur-2xl border transition-all duration-500 h-full flex flex-col items-center py-8 gap-8 pointer-events-auto rounded-[36px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] ${isDarkBase ? 'bg-slate-900/90 border-slate-700/50' : 'bg-white/95 border-slate-200/50'}`}>
        <button 
          title="Import Studio" 
          onClick={() => props.setActiveTab(props.activeTab === 'studio' ? null : 'studio')} 
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 
            ${props.activeTab === 'studio' 
              ? 'bg-indigo-600 text-white scale-110 shadow-[0_0_20px_rgba(79,70,229,0.5)]' 
              : `bg-slate-50/10 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] ${isDarkBase ? 'text-slate-400' : ''}`
            }`}
        >
          <MapPinned size={22} />
        </button>
        
        <button 
          title="Filter Layers" 
          onClick={() => props.setActiveTab(props.activeTab === 'filter' ? null : 'filter')} 
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 
            ${props.activeTab === 'filter' 
              ? 'bg-indigo-600 text-white scale-110 shadow-[0_0_20px_rgba(79,70,229,0.5)]' 
              : `bg-slate-50/10 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] ${isDarkBase ? 'text-slate-400' : ''}`
            }`}
        >
          <LayoutGrid size={22} />
        </button>
        
        <button 
          title="Directory" 
          onClick={() => props.setActiveTab(props.activeTab === 'directory' ? null : 'directory')} 
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 
            ${props.activeTab === 'directory' 
              ? 'bg-emerald-600 text-white scale-110 shadow-[0_0_20px_rgba(16,185,129,0.5)]' 
              : `bg-slate-50/10 text-slate-400 hover:bg-white hover:text-emerald-600 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] ${isDarkBase ? 'text-slate-400' : ''}`
            }`}
        >
          <LibraryBig size={22} />
        </button>

        <button 
          title="Visual Snap" 
          onClick={() => props.setActiveTab(props.activeTab === 'snap' ? null : 'snap')} 
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 mt-auto
            ${props.activeTab === 'snap' 
              ? 'bg-indigo-600 text-white scale-110 shadow-[0_0_20px_rgba(79,70,229,0.5)]' 
              : `bg-slate-50/10 text-slate-400 hover:bg-white hover:text-indigo-600 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] ${isDarkBase ? 'text-slate-400' : ''}`
            }`}
        >
          <Camera size={22} />
        </button>
      </div>
      <div ref={sidebarRef} className={`transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] overflow-hidden ${props.activeTab ? 'w-80 opacity-100 ml-5 translate-x-0' : 'w-0 opacity-0 ml-0 -translate-x-10'} pointer-events-auto h-full`}>
        <div className={`w-80 h-full backdrop-blur-3xl border rounded-[40px] flex flex-col shadow-[0_30px_60px_rgba(0,0,0,0.15)] overflow-hidden transition-all duration-500 ${isDarkBase ? 'bg-slate-900/95 border-slate-700/50' : 'bg-white/98 border-slate-200/50'}`}>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <TabContent tab={props.activeTab} {...props} hierarchyData={hierarchyData} onUpload={handleFileUpload} uploadFeedback={uploadFeedback} setUploadFeedback={setUploadFeedback} />
          </div>
        </div>
      </div>
    </div>
  );
};

const TabContent = ({ tab, points, onUpload, hierarchyData, onClear, searchQuery, setSearchQuery, availableCategories, selectedCategories, setSelectedCategories, hiddenProvinces, onToggleProvince, onToggleAllProvinces, onFitActive, provincesInData, onProvinceSelect, onMunicipalitySelect, uploadFeedback, setUploadFeedback, highlightedProvince, highlightedMunicipality, showMarkers, setShowMarkers, showProvinces, setShowProvinces, showLabels, setShowLabels, showBorders, setShowBorders, showNameMarkers, setShowNameMarkers, onStartSnip, onCaptureFull, isCapturing, lastSnapUrl, onGenerateSnap, baseLayer, denominators, categoryTotals }: any) => {
    if (!tab) return null;
    const [expandedProv, setExpandedProv] = useState<string | null>(null);
    const [expandedMun, setExpandedMun] = useState<string | null>(null);
    
    const isDarkBase = baseLayer === 'dark' || baseLayer === 'satellite' || baseLayer === 'hybrid';
    const theme = {
      textMain: isDarkBase ? 'text-white' : 'text-slate-900',
      textSub: isDarkBase ? 'text-slate-400' : 'text-slate-400',
      textLabel: isDarkBase ? 'text-slate-300' : 'text-slate-700',
      bgInput: isDarkBase ? 'bg-slate-800/50' : 'bg-slate-50',
      border: isDarkBase ? 'border-slate-700/50' : 'border-slate-100',
    };

    const isAllCatsSelected = selectedCategories.length === availableCategories.length;
    const isSoloMode = !!highlightedProvince;

    const handleReturn = () => {
        onProvinceSelect(null);
        onMunicipalitySelect(null);
        setExpandedProv(null);
        setExpandedMun(null);
    };

    const hierarchy = hierarchyData.hierarchy;
    const totalInvestment = hierarchyData.totalInvestment;

    return (
        <div className="flex flex-col h-full space-y-8 px-6 py-10">
            {tab === 'studio' && (
                <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${theme.textSub}`}><Upload size={14} /> Source Deployment</h3>
                      </div>
                      <div className={`relative border-2 border-dashed rounded-3xl p-8 text-center transition-all group cursor-pointer hover:shadow-[0_0_25px_rgba(79,70,229,0.1)] ${isDarkBase ? 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50' : 'border-slate-200 bg-slate-50/50 hover:bg-white'}`}>
                          <input type="file" accept=".csv,.xlsx" onChange={onUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                          <div className={`w-12 h-12 rounded-2xl shadow-sm border flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-all ${isDarkBase ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white border-slate-100 text-indigo-600'}`}>
                            <Upload size={22} />
                          </div>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${theme.textMain}`}>Import Regional Matrix</p>
                      </div>
                    </section>

                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${theme.textSub}`}><Coins size={14} /> Investment Matrix</h3>
                        {isSoloMode && (
                            <button onClick={handleReturn} className="text-[9px] font-black text-indigo-400 uppercase flex items-center gap-1 hover:brightness-125 transition-all"><RotateCcw size={10}/> Reset</button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {Object.entries(hierarchy).map(([prov, pData]: [string, any]) => {
                          const isActive = highlightedProvince === prov;
                          const isHiddenBySolo = isSoloMode && !isActive;
                          if (isHiddenBySolo) return null;

                          const share = totalInvestment > 0 ? (pData.investment / totalInvestment) * 100 : 0;
                          return (
                            <div key={prov} className={`p-3 rounded-2xl border transition-all ${isActive ? 'bg-indigo-500/10 border-indigo-500/50 shadow-sm' : `${isDarkBase ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-100'} hover:border-indigo-400`}`}>
                               <div className="flex justify-between items-center mb-1.5">
                                 <span className={`text-[9px] font-black uppercase ${isActive ? 'text-indigo-400' : theme.textMain}`}>{prov}</span>
                                 <span className="text-[9px] font-black text-indigo-500">₱{(pData.investment / 1000000).toFixed(1)}M</span>
                               </div>
                               <div className={`w-full h-1 rounded-full overflow-hidden ${isDarkBase ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                 <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${share}%` }} />
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <button onClick={onClear} className={`w-full p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isDarkBase ? 'bg-red-950/20 text-red-500 border border-red-900/50 hover:bg-red-950/40' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}>
                      <Trash2 size={14} /> Purge Master Index
                    </button>
                </div>
            )}

            {tab === 'filter' && (
                <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                    <section>
                        <h3 className={`text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${theme.textSub}`}><Settings2 size={14} /> Atlas Controls</h3>
                        <div className="grid grid-cols-2 gap-2">
                           {[
                             { id: 'markers', label: 'Markers', val: showMarkers, set: setShowMarkers, icon: Box },
                             { id: 'provinces', label: 'Polygons', val: showProvinces, set: setShowProvinces, icon: Layers2 },
                             { id: 'labels', label: 'Basemap', val: showLabels, set: setShowLabels, icon: Type },
                             { id: 'borders', label: 'Borders', val: showBorders, set: setShowBorders, icon: Square },
                             { id: 'names', label: 'Names', val: showNameMarkers, set: setShowNameMarkers, icon: Tag },
                           ].map(ctrl => (
                             <button key={ctrl.id} onClick={() => ctrl.set(!ctrl.val)} className={`flex items-center gap-2 p-3 rounded-xl border text-[9px] font-black uppercase transition-all ${ctrl.val ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : `${isDarkBase ? 'bg-slate-800/40 border-slate-700 text-slate-500' : 'bg-slate-50 border-transparent text-slate-400'} opacity-60 hover:opacity-100 hover:bg-indigo-500/10`}`}>
                                <ctrl.icon size={14} /> {ctrl.label}
                             </button>
                           ))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${theme.textSub}`}><Filter size={14} /> Domain Layers</h3>
                          <button onClick={() => setSelectedCategories(isAllCatsSelected ? [] : availableCategories)} className="text-[9px] font-black text-indigo-400 uppercase transition-all hover:brightness-125">{isAllCatsSelected ? 'Select None' : 'Select All'}</button>
                        </div>
                        <div className="space-y-1.5 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                            {availableCategories.map(cat => {
                                const isSelected = selectedCategories.includes(cat);
                                const total = categoryTotals?.[cat] || 0;
                                let metricStr = `${total}`;
                                let displayLabel = cat;
                                let tooltipStr = `${total} facilities total`;
                                
                                if (cat === 'BHS') {
                                  displayLabel = 'BHS';
                                  metricStr = `${total}/${denominators?.brgys || 0}`;
                                  tooltipStr = `no. of BHS: ${total} / total no. of local barangay: ${denominators?.brgys || 0}`;
                                } else if (cat === 'RHU') {
                                  displayLabel = 'RHU';
                                  metricStr = `${total}/${denominators?.muns || 0}`;
                                  tooltipStr = `no. of RHU: ${total} / total no. of local municipality: ${denominators?.muns || 0}`;
                                }

                                return (
                                    <button 
                                        key={cat} 
                                        title={tooltipStr}
                                        onClick={() => setSelectedCategories(isSelected ? selectedCategories.filter((c: any) => c !== cat) : [...selectedCategories, cat])} 
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${isSelected ? (isDarkBase ? 'bg-white/10 border-indigo-500/50 shadow-lg' : 'bg-white border-indigo-100 shadow-sm') : 'bg-transparent border-transparent opacity-40 grayscale hover:opacity-70 hover:grayscale-0'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                          <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: CATEGORY_MAP[cat]?.color || CATEGORY_MAP['Other'].color }} />
                                          <span className={`text-[9.5px] font-black uppercase tracking-tight transition-colors ${isSelected ? (isDarkBase ? 'text-white' : 'text-slate-800') : theme.textLabel}`}>
                                            {displayLabel}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[8px] font-black tabular-nums py-0.5 px-1.5 rounded-md ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                {metricStr}
                                            </span>
                                            <ChevronRight size={12} className={isSelected ? 'text-indigo-400' : 'text-slate-300'} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <div className="relative group">
                        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isDarkBase ? 'text-slate-500 group-focus-within:text-indigo-400' : 'text-slate-400 group-focus-within:text-indigo-600'}`} size={14} />
                        <input type="text" placeholder="QUICK FILTER..." className={`w-full border rounded-xl py-4 pl-10 pr-4 text-[9px] font-black outline-none transition-all ${isDarkBase ? 'bg-slate-800/40 border-slate-700 text-white focus:border-indigo-500/50' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-300 focus:bg-white'}`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                </div>
            )}

            {tab === 'directory' && (
                <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2 ${theme.textSub}`}>
                                Regional Directory
                            </h3>
                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Consolidated Facilities Index</p>
                        </div>
                        {isSoloMode && (
                            <button 
                                onClick={handleReturn}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${isDarkBase ? 'bg-slate-800 text-indigo-400 hover:bg-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                            >
                                <RotateCcw size={10} /> Reset
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {Object.entries(hierarchy).map(([prov, pData]: [string, any]) => {
                            const isActive = highlightedProvince === prov;
                            const isHiddenBySolo = isSoloMode && !isActive;
                            
                            if (isHiddenBySolo) return null;

                            const isIndependentCity = prov.toUpperCase().includes("COTABATO CITY") || prov.toUpperCase().includes("MARAWI CITY");
                            const totalBrgysCount = Object.values(pData.muns).reduce((acc: number, m: any) => acc + Object.keys(m.brgys).length, 0);
                            const totalMunsCount = Object.keys(pData.muns).length;
                            
                            const subCount = isIndependentCity ? totalBrgysCount : totalMunsCount;
                            const unitLabel = isIndependentCity ? "BARANGAY" : "MUNICIPALITY";
                            const formattedLabel = `${prov} (${subCount} ${unitLabel})`;

                            return (
                                <div key={prov} className="animate-in fade-in zoom-in-95 duration-300">
                                    <div className={`border rounded-[24px] overflow-hidden transition-all duration-300 ${isActive ? 'bg-indigo-500/10 border-indigo-500/30 shadow-md ring-1 ring-indigo-500/10' : `${isDarkBase ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-slate-100'} hover:border-slate-400 hover:shadow-lg shadow-sm`}`}>
                                        <div className="flex items-center justify-between p-4 group cursor-pointer" onClick={() => {
                                                    onProvinceSelect(prov);
                                                    setExpandedProv(expandedProv === prov ? null : prov);
                                                }}>
                                            <div className="flex-1 text-left flex flex-col">
                                                <span className={`text-[8px] font-black uppercase tracking-tighter truncate ${isActive ? 'text-indigo-400' : theme.textMain}`}>
                                                  {formattedLabel}
                                                </span>
                                                <span className="text-[8.5px] font-bold text-slate-500 mt-0.5 uppercase tracking-widest">{pData.count} Facilities</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={(e) => { e.stopPropagation(); onFitActive(); }} className={`p-2 rounded-xl transition-all ${isActive ? (isDarkBase ? 'text-white bg-indigo-600' : 'text-indigo-600 bg-white shadow-sm hover:scale-110') : 'text-slate-500 hover:text-indigo-400'}`} title="Refocus Area"><Maximize2 size={13} /></button>
                                                <ChevronDown size={14} className={`transition-transform duration-300 ${expandedProv === prov ? 'rotate-180 text-indigo-500' : 'text-slate-500'}`} />
                                            </div>
                                        </div>

                                        {expandedProv === prov && (
                                            <div className={`border-t p-4 space-y-3 ${isDarkBase ? 'bg-slate-900/50 border-slate-700' : 'bg-white/50 border-indigo-100'}`}>
                                                {Object.entries(pData.muns).sort(([a], [b]) => a.localeCompare(b)).map(([mun, mData]: [string, any]) => {
                                                    const isMunActive = highlightedMunicipality === mun;
                                                    return (
                                                        <div key={mun} className="space-y-1">
                                                            <button 
                                                                onClick={() => {
                                                                    onMunicipalitySelect(expandedMun === mun ? null : mun);
                                                                    setExpandedMun(expandedMun === mun ? null : mun);
                                                                }}
                                                                className={`w-full flex items-center justify-between py-2 px-3 rounded-xl transition-all ${isMunActive ? (isDarkBase ? 'bg-indigo-600/40 text-white' : 'bg-indigo-100/50 text-indigo-700 shadow-sm') : `hover:bg-indigo-500/5 ${theme.textLabel}`}`}
                                                            >
                                                                <span className="text-[9px] font-black uppercase tracking-tight">{mun}</span>
                                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${isDarkBase ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-white border-indigo-100'}`}>{mData.count}</span>
                                                            </button>
                                                            
                                                            {expandedMun === mun && (
                                                                <div className={`ml-4 pl-3 border-l pt-1 space-y-1.5 animate-in slide-in-from-left-1 ${isDarkBase ? 'border-slate-700' : 'border-indigo-100'}`}>
                                                                    {Object.entries(mData.brgys).sort(([a], [b]) => a.localeCompare(b)).map(([brgy, bData]: [string, any]) => (
                                                                        <div key={brgy} className={`flex items-center justify-between group p-1 rounded-lg transition-all ${isDarkBase ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                                                                            <span className={`text-[8px] font-bold uppercase tracking-widest truncate max-w-[140px] ${theme.textSub} group-hover:text-indigo-400`}>{brgy}</span>
                                                                            <span className="text-[9px] font-black text-indigo-500/80">{bData.count}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {tab === 'snap' && (
                <div className="space-y-8 animate-in slide-in-from-left-4 duration-500 h-full flex flex-col">
                    <section>
                        <div className="flex flex-col mb-4">
                            <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${theme.textSub}`}>
                                <Camera size={14} className="text-indigo-500" /> Visual Intelligence
                            </h3>
                            <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 ${theme.textSub}`}>High-Resolution Matrix Artifacts</p>
                        </div>
                        
                        {!lastSnapUrl && !isCapturing && (
                            <div className={`border border-dashed rounded-[32px] p-10 text-center flex flex-col items-center gap-4 ${isDarkBase ? 'bg-slate-800/20 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                <div className={`w-16 h-16 rounded-3xl shadow-sm border flex items-center justify-center ${isDarkBase ? 'bg-slate-800 border-slate-700 text-slate-600' : 'bg-white border-slate-100 text-slate-300'}`}>
                                    <ImageIcon size={32} />
                                </div>
                                <div className="space-y-1">
                                    <p className={`text-[9px] font-black uppercase tracking-widest ${theme.textMain}`}>No Active Snap</p>
                                    <p className={`text-[8px] font-bold uppercase tracking-wider ${theme.textSub}`}>Capture the workspace to begin</p>
                                </div>
                            </div>
                        )}

                        {isCapturing && (
                            <div className={`border border-indigo-500/30 border-dashed rounded-[32px] p-10 text-center flex flex-col items-center gap-4 animate-pulse ${isDarkBase ? 'bg-slate-800/40' : 'bg-slate-50'}`}>
                                <Loader2 className="text-indigo-500 animate-spin" size={32} />
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Rendering Viewport</p>
                                    <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider">Synchronizing Layers...</p>
                                </div>
                            </div>
                        )}

                        {lastSnapUrl && !isCapturing && (
                            <div className="space-y-6 animate-in zoom-in-95 duration-500">
                                <div className={`relative group overflow-hidden rounded-[32px] border-4 shadow-2xl aspect-[4/3] ${isDarkBase ? 'border-slate-800 bg-slate-800' : 'border-white bg-white'}`}>
                                    <img src={lastSnapUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Capture Preview" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                        <p className="text-[8px] font-black text-white uppercase tracking-[0.2em]">Mindanao Intelligence Snap</p>
                                    </div>
                                    <div className="absolute top-2 right-2 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg">
                                        <CheckCircle2 size={12} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => onCaptureFull('png')}
                                        className="bg-indigo-600 text-white p-4 rounded-2xl flex flex-col items-center gap-2 hover:bg-indigo-700 hover:shadow-lg transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                                    >
                                        <FileImage size={20} />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Export PNG</span>
                                    </button>
                                    <button 
                                        onClick={() => onCaptureFull('pdf')}
                                        className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-95 shadow-lg ${isDarkBase ? 'bg-slate-700 text-white hover:bg-slate-600 shadow-slate-900/40' : 'bg-slate-900 text-white hover:bg-black shadow-slate-200'}`}
                                    >
                                        <FileText size={20} />
                                        <span className="text-[8px] font-black uppercase tracking-widest">Export PDF</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    <div className="mt-auto space-y-4">
                        <button 
                            onClick={onGenerateSnap}
                            disabled={isCapturing}
                            className={`w-full py-5 rounded-[24px] font-black text-[10px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 transition-all ${
                                isCapturing ? 'bg-slate-800 text-slate-600' : (isDarkBase ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shadow-sm')
                            }`}
                        >
                            {isCapturing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                            {lastSnapUrl ? 'Refresh Snap' : 'Generate Snap'}
                        </button>

                        <button 
                            onClick={onStartSnip}
                            className={`w-full py-4 border rounded-[24px] font-black text-[9px] uppercase tracking-[0.2em] transition-all ${isDarkBase ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'} flex items-center justify-center gap-2`}
                        >
                            <Scissors size={14} /> Rectangular Snipping
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppNavigation;
