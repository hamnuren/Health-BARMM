
import React, { useState, useEffect, useMemo } from 'react';
import AppNavigation from './components/AppNavigation';
import DetailSidebar from './components/DetailSidebar';
import MapComponent from './components/MapComponent';
import ProvinceViewControl from './components/ProvinceViewControl';
import SnippingOverlay from './components/SnippingOverlay';
import { GeoPoint, BaseLayerType } from './types';
import { Activity } from 'lucide-react';
import Papa from 'papaparse';
import { HEALTH_FACILITIES_CSV } from './constants/healthData';
import { savePointsToStorage, getPointsFromStorage, clearStorage } from './services/storageService';
import { isPointInProvince, BARMM_PROVINCES } from './constants/provinces';
import { CATEGORY_MAP } from './constants/mapConfig';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const DEFAULT_VIEW = { center: [6.85, 122.2] as [number, number], zoom: 7.1 };

/** 
 * Official MOH-BARMM Hospital Matrix (29 Logical Entities)
 */
const CANONICAL_HOSPITALS = [
  // Basilan (3)
  { name: "LAMITAN DISTRICT HOSPITAL", keywords: ["LAMITAN"], prov: "BASILAN" },
  { name: "SUMISIP DISTRICT HOSPITAL", keywords: ["SUMISIP"], prov: "BASILAN" },
  { name: "TIPO-TIPO MUNICIPAL HOSPITAL", keywords: ["TIPO-TIPO", "TIPO TIPO"], prov: "BASILAN" },
  // Lanao del Sur (6)
  { name: "BALINDONG MUNICIPAL HOSPITAL", keywords: ["BALINDONG"], prov: "LANAO" },
  { name: "DR. SERAPIO B. MONTAÑER JR. AL HAJ MEMORIAL HOSPITAL", keywords: ["MONTAÑER", "MALABANG"], prov: "LANAO" },
  { name: "TAMPARAN DISTRICT HOSPITAL", keywords: ["TAMPARAN"], prov: "LANAO" },
  { name: "UNAYAN DISTRICT HOSPITAL", keywords: ["UNAYAN", "BINIDAYAN"], prov: "LANAO" },
  { name: "WAO DISTRICT HOSPITAL", keywords: ["WAO"], prov: "LANAO" },
  { name: "MARANTAO PROVINCIAL HOSPITAL", keywords: ["MARANTAO"], prov: "LANAO" },
  // Maguindanao del Norte (3)
  { name: "DATU ODIN SINSUAT DISTRICT HOSPITAL", keywords: ["ODIN SINSUAT", "DINAIG"], prov: "MAGUINDANAO" },
  { name: "DATU BLAH SINSUAT DISTRICT HOSPITAL", keywords: ["BLAH SINSUAT", "UPI"], prov: "MAGUINDANAO" },
  { name: "IRANUN DISTRICT HOSPITAL", keywords: ["IRANUN", "PARANG"], prov: "MAGUINDANAO" },
  // Maguindanao del Sur (3)
  { name: "MAGUINDANAO PROVINCIAL HOSPITAL", keywords: ["MAGUINDANAO PROVINCIAL", "SHARIFF AGUAK"], prov: "MAGUINDANAO" },
  { name: "BULUAN DISTRICT HOSPITAL", keywords: ["BULUAN"], prov: "MAGUINDANAO" },
  { name: "SOUTH UPI MUNICIPAL HOSPITAL", keywords: ["SOUTH UPI"], prov: "MAGUINDANAO" },
  // Sulu (9)
  { name: "SULU PROVINCIAL HOSPITAL", keywords: ["SULU PROVINCIAL", "JOLO"], prov: "SULU" },
  { name: "LUUK DISTRICT HOSPITAL", keywords: ["LUUK"], prov: "SULU" },
  { name: "PANAMAO DISTRICT HOSPITAL", keywords: ["PANAMAO"], prov: "SULU" },
  { name: "PARANG DISTRICT HOSPITAL (SULU)", keywords: ["PARANG"], prov: "SULU" },
  { name: "SIASI DISTRICT HOSPITAL", keywords: ["SIASI"], prov: "SULU" },
  { name: "PANGUTARAN DISTRICT HOSPITAL", keywords: ["PANGUTARAN"], prov: "SULU" },
  { name: "TAPUL MUNICIPAL HOSPITAL", keywords: ["TAPUL"], prov: "SULU" },
  { name: "TONGKIL MUNICIPAL HOSPITAL", keywords: ["TONGKIL", "BANGUINGUI"], prov: "SULU" },
  { name: "MAIMBUNG MUNICIPAL HOSPITAL", keywords: ["MAIMBUNG"], prov: "SULU" },
  // Tawi-Tawi (5)
  { name: "DATU HALUN SAKILAN MEMORIAL HOSPITAL", keywords: ["HALUN SAKILAN", "TAWI-TAWI PROVINCIAL"], prov: "TAWI-TAWI" },
  { name: "LANGUYAN MUNICIPAL HOSPITAL", keywords: ["LANGUYAN"], prov: "TAWI-TAWI" },
  { name: "MAPUN DISTRICT HOSPITAL", keywords: ["MAPUN", "CAGAYAN DE TAWI-TAWI"], prov: "TAWI-TAWI" },
  { name: "TUAN LIGADDUNG LIPAE MEMORIAL HOSPITAL", keywords: ["TUAN LIGADDUNG", "SAPA-SAPA"], prov: "TAWI-TAWI" },
  { name: "DATU ALAWADIN T. BANDON, SR. MUNICIPAL HOSPITAL", keywords: ["ALAWADIN", "SIBUTO", "BANDON"], prov: "TAWI-TAWI" }
];

const NATIONAL_EXCLUSIONS = [
  "AMAI PAKPAK", "BASILAN GENERAL", "COTABATO SANITARIUM", "COTABATO REGIONAL", 
  "CRMC", "APMC", "CAMP SIONGCO", "DAVAO MEDICAL", "SOUTHERN PHILIPPINES", 
  "ZAMBOANGA CITY", "PRIVATE", "MEDICAL CENTER"
];

/**
 * Enhanced Resolver: Uses Name, Province, and Municipality to disambiguate.
 */
const resolveHospitalIdentity = (rawName: string, provHint?: string, munHint?: string): string | null => {
  const n = rawName.toUpperCase();
  const p = (provHint || '').toUpperCase();
  const m = (munHint || '').toUpperCase();
  
  // 1. Strict Exclusion (National/Private)
  if (NATIONAL_EXCLUSIONS.some(ex => n.includes(ex)) && !n.includes("SULU SANITARIUM")) return null;

  // 2. Specialized Logic for "PARANG" Collision
  if (n.includes("PARANG") || m.includes("PARANG")) {
    if (p.includes("SULU")) return "PARANG DISTRICT HOSPITAL (SULU)";
    if (p.includes("MAGUINDANAO")) return "IRANUN DISTRICT HOSPITAL";
  }

  // 3. Keyword + Province Matching
  for (const entry of CANONICAL_HOSPITALS) {
    const isProvMatch = !p || p.includes(entry.prov);
    const hasKeyword = entry.keywords.some(k => n.includes(k.toUpperCase()) || m.includes(k.toUpperCase()));
    
    if (hasKeyword && isProvMatch) {
      return entry.name;
    }
  }

  // 4. Fallback: Relaxed Keyword Match (ignore province if keywords are strong/unique)
  for (const entry of CANONICAL_HOSPITALS) {
    if (entry.keywords.some(k => n.includes(k.toUpperCase()))) {
      return entry.name;
    }
  }

  return null;
};

export const cleanFacilityName = (name: string, category?: string, prov?: string, mun?: string): string => {
  if (!name) return 'Unknown Facility';
  const n = name.toUpperCase().trim();
  const cat = (category || 'Other').toUpperCase();

  if (cat.includes('HOSPITAL')) {
    const resolved = resolveHospitalIdentity(n, prov, mun);
    if (resolved) return resolved;
  }

  // Standard clean for BHS/RHU
  let cleaned = n;
  const delimiters = [' - ', ' – ', ' : ', ' FOR ', '(', '/'];
  delimiters.forEach(d => { cleaned = cleaned.split(d)[0].trim(); });
  const noise = [/CONSTRUCTION/g, /REPAIR/g, /NEW/g, /EQUIPPING/g, /PHASE \d+/g, /UPGRADE/g, /REHABILITATION/g, /BUILDING/g];
  noise.forEach(pattern => { cleaned = cleaned.replace(pattern, '').trim(); });

  return cleaned.replace(/\s+/g, ' ').trim();
};

const getNormalizedFacilityKey = (p: GeoPoint): string => {
  const cat = (p.category || 'Other').toUpperCase().trim();
  const prov = (p.data?.Province || p.data?.province || 'BARMM').toString().toUpperCase().trim();
  const mun = (p.municipality || p.data?.Municipality || 'UNKNOWN').toString().toUpperCase().trim();
  
  const cleanName = cleanFacilityName(p.name, cat, prov, mun);
  
  if (cat.includes('HOSPITAL')) {
    return `HOSPITAL|${cleanName}`;
  }

  return `${cleanName}|${cat}|${mun}|${prov}`;
};

const App: React.FC = () => {
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [highlightedProvince, setHighlightedProvince] = useState<string | null>(null);
  const [highlightedMunicipality, setHighlightedMunicipality] = useState<string | null>(null);
  const [hiddenProvinces, setHiddenProvinces] = useState<Set<string>>(new Set());
  
  const [showMarkers, setShowMarkers] = useState(true);
  const [showProvinces, setShowProvinces] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showBorders, setShowBorders] = useState(true);
  const [showNameMarkers, setShowNameMarkers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [mapView, setMapView] = useState(DEFAULT_VIEW);
  const [baseLayer, setBaseLayer] = useState<BaseLayerType>('standard');
  const [fitTrigger, setFitTrigger] = useState(0);

  const [isSnipping, setIsSnipping] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [lastSnapUrl, setLastSnapUrl] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string | null>(window.innerWidth > 768 ? 'filter' : null);
  const isSidebarExpanded = !!activeTab;

  const provincesInData = useMemo(() => {
    const set = new Set<string>();
    points.forEach(p => {
      const prov = (p.data?.Province || p.data?.province || 'Unknown').toString();
      set.add(prov);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [points]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    points.forEach(p => {
      cats.add(p.category || 'Other');
    });
    return Array.from(cats).sort();
  }, [points]);

  useEffect(() => {
    if (availableCategories.length > 0 && selectedCategories.length === 0) {
      setSelectedCategories(availableCategories);
    }
  }, [availableCategories]);

  useEffect(() => {
    const loadInitialData = async () => {
      setIsUploading(true);
      try {
        const storedPoints = await getPointsFromStorage();
        if (storedPoints && storedPoints.length > 0) {
          setPoints(storedPoints);
          setIsUploading(false);
          return;
        }
        const loadedPoints: GeoPoint[] = [];
        Papa.parse(HEALTH_FACILITIES_CSV, {
          header: true, skipEmptyLines: true,
          step: (results) => {
            const r: any = results.data;
            const lat = parseFloat(r.Latitude || r.latitude || r.Y);
            const lng = parseFloat(r.Longitude || r.longitude || r.X);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            loadedPoints.push({
              id: `init-${loadedPoints.length}`,
              lat, lng,
              name: r['Name of Facility'] || 'Health Facility',
              municipality: r['Municipality'] || '',
              category: r['Facility type'] || 'Other',
              data: r
            });
          },
          complete: async () => {
            setPoints(loadedPoints);
            await savePointsToStorage(loadedPoints);
            setIsUploading(false);
          }
        });
      } catch (error) { setIsUploading(false); }
    };
    loadInitialData();
  }, []);

  const isValidBARMMFacility = (p: GeoPoint): boolean => {
    const cat = (p.category || 'Other').toUpperCase();
    if (cat.includes('HOSPITAL')) {
      const prov = (p.data?.Province || p.data?.province || '').toString();
      const mun = (p.municipality || p.data?.Municipality || '').toString();
      return resolveHospitalIdentity(p.name, prov, mun) !== null;
    }
    return true;
  };

  const clusteredPoints = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const clusters: Record<string, GeoPoint> = {};

    points.forEach(p => {
      if (!isValidBARMMFacility(p)) return;

      const pProv = (p.data?.Province || p.data?.province || 'Unknown').toString();
      const pMun = (p.municipality || p.data?.Municipality || '').toString();

      if (highlightedProvince) {
        if (!pProv.toUpperCase().includes(highlightedProvince.toUpperCase()) && 
            !isPointInProvince(p.lat, p.lng, highlightedProvince)) return;
      }
      if (highlightedMunicipality && pMun.toUpperCase() !== highlightedMunicipality.toUpperCase()) return;
      if (hiddenProvinces.has(pProv.toUpperCase())) return;
      
      const cat = p.category || 'Other';
      if (!selectedCategories.includes(cat)) return;
      if (query && !p.name.toLowerCase().includes(query) && !pMun.toLowerCase().includes(query)) return;

      const identityKey = getNormalizedFacilityKey(p);
      
      if (!clusters[identityKey]) {
        clusters[identityKey] = { 
          ...p, 
          name: cleanFacilityName(p.name, p.category, pProv, pMun), 
          facilities: [p] 
        };
      } else {
        clusters[identityKey].facilities?.push(p);
      }
    });

    return Object.values(clusters);
  }, [points, selectedCategories, searchQuery, highlightedProvince, highlightedMunicipality, hiddenProvinces]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const seenFacilities = new Set<string>();

    points.forEach(p => {
      if (!isValidBARMMFacility(p)) return;

      const pProv = (p.data?.Province || p.data?.province || 'Unknown').toString();
      const pMun = (p.municipality || p.data?.Municipality || 'UNKNOWN').toString();
      
      if (highlightedProvince && !pProv.toUpperCase().includes(highlightedProvince.toUpperCase()) && !isPointInProvince(p.lat, p.lng, highlightedProvince)) return;
      if (highlightedMunicipality && pMun.toUpperCase() !== highlightedMunicipality.toUpperCase()) return;
      if (hiddenProvinces.has(pProv.toUpperCase())) return;

      const cat = p.category || 'Other';
      const identityKey = getNormalizedFacilityKey(p);
      
      if (!seenFacilities.has(identityKey)) {
        seenFacilities.add(identityKey);
        totals[cat] = (totals[cat] || 0) + 1;
      }
    });
    return totals;
  }, [points, highlightedProvince, highlightedMunicipality, hiddenProvinces]);

  const denominators = useMemo(() => {
    if (highlightedProvince) {
      const ref = BARMM_PROVINCES.find(p => p.name.toUpperCase().includes(highlightedProvince.toUpperCase()));
      if (ref) return { muns: ref.totalMunicipalities, brgys: ref.totalBarangays };
    }
    const activeProvinces = provincesInData.filter(p => !hiddenProvinces.has(p.toUpperCase()));
    let totalMuns = 0, totalBrgys = 0;
    activeProvinces.forEach(provName => {
        const ref = BARMM_PROVINCES.find(p => p.name.toUpperCase().includes(provName.toUpperCase()));
        if (ref) { totalMuns += ref.totalMunicipalities; totalBrgys += ref.totalBarangays; }
    });
    return totalMuns > 0 ? { muns: totalMuns, brgys: totalBrgys } : { muns: 1, brgys: 1 };
  }, [points, highlightedProvince, hiddenProvinces, provincesInData]);

  const triggerCapture = async (rect?: { x: number, y: number, width: number, height: number }, format: 'png' | 'pdf' | 'url' = 'png') => {
    if (isCapturing) return;
    setIsCapturing(true);
    const root = document.getElementById('root');
    if (!root) { setIsCapturing(false); return; }
    try {
      await new Promise(r => setTimeout(r, 100));
      const pixelRatio = format === 'url' ? 1.5 : 3;
      const options: any = { pixelRatio, quality: 1, filter: (node: HTMLElement) => !node.classList?.contains('exclude-from-screenshot') };
      if (rect) { options.width = rect.width; options.height = rect.height; options.left = rect.x; options.top = rect.y; }
      const dataUrl = await toPng(root, options);
      if (format === 'url') { setLastSnapUrl(dataUrl); setIsCapturing(false); return dataUrl; }
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 400);
      const filename = `BARMM-Intelligence-${new Date().toISOString().split('T')[0]}`;
      if (format === 'png') { 
        const link = document.createElement('a'); link.download = `${filename}.png`; link.href = dataUrl; document.body.appendChild(link); link.click(); document.body.removeChild(link); 
      } else { 
        const pdf = new jsPDF({ orientation: root.clientWidth > root.clientHeight ? 'landscape' : 'portrait', unit: 'px', format: rect ? [rect.width, rect.height] : [root.clientWidth, root.clientHeight] }); 
        pdf.addImage(dataUrl, 'PNG', 0, 0, rect ? rect.width : root.clientWidth, rect ? rect.height : root.clientHeight, undefined, 'FAST'); 
        pdf.save(`${filename}.pdf`); 
      }
    } catch (err) { alert('Capture failed.'); } finally { setIsCapturing(false); }
  };

  return (
    <div className={`relative h-screen w-full bg-slate-100 overflow-hidden font-sans ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
      {showFlash && <div className="flash-effect" />}
      <div className="absolute inset-0 z-0">
        <MapComponent 
          center={mapView.center} zoom={mapView.zoom} points={clusteredPoints}
          highlightedProvince={highlightedProvince}
          highlightedMunicipality={highlightedMunicipality}
          showMarkers={showMarkers} showProvinces={showProvinces}
          showLabels={showLabels} showBorders={showBorders}
          showNameMarkers={showNameMarkers}
          onMarkerDoubleClick={(p) => setSelectedPoint(p)}
          onProvinceSelect={(p) => { setHighlightedProvince(p); setHighlightedMunicipality(null); setFitTrigger(v => v + 1); }}
          onResetView={() => { setHighlightedProvince(null); setHighlightedMunicipality(null); setMapView(DEFAULT_VIEW); setFitTrigger(v => v + 1); }}
          baseLayer={baseLayer} setBaseLayer={setBaseLayer}
          categoryTotals={categoryTotals} fitTrigger={fitTrigger} denominators={denominators}
        />
      </div>
      {!isSnipping && (
        <>
          <AppNavigation 
            activeTab={activeTab} setActiveTab={setActiveTab}
            onDataUpload={async (data) => { setIsUploading(true); await savePointsToStorage(data); setPoints(data); setIsUploading(false); }}
            onClear={async () => { await clearStorage(); setPoints([]); setHighlightedProvince(null); setMapView(DEFAULT_VIEW); }}
            onSearch={(lat, lng) => setMapView({ center: [lat, lng], zoom: 14 })}
            onProvinceSelect={(p) => { setHighlightedProvince(p); setHighlightedMunicipality(null); setFitTrigger(v => v + 1); }}
            onMunicipalitySelect={(m) => { setHighlightedMunicipality(m); setFitTrigger(v => v + 1); }}
            points={points} highlightedProvince={highlightedProvince} highlightedMunicipality={highlightedMunicipality}
            showMarkers={showMarkers} setShowMarkers={setShowMarkers}
            showProvinces={showProvinces} setShowProvinces={setShowProvinces}
            showLabels={showLabels} setShowLabels={setShowLabels}
            showBorders={showBorders} setShowBorders={setShowBorders}
            showNameMarkers={showNameMarkers} setShowNameMarkers={setShowNameMarkers}
            availableCategories={availableCategories}
            selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            baseLayer={baseLayer} setBaseLayer={setBaseLayer}
            hiddenProvinces={hiddenProvinces}
            onToggleProvince={(n) => setHiddenProvinces(p => { const next = new Set(p); if (next.has(n.toUpperCase())) next.delete(n.toUpperCase()); else next.add(n.toUpperCase()); return next; })}
            onToggleAllProvinces={(v) => setHiddenProvinces(v ? new Set() : new Set(provincesInData.map(p => p.toUpperCase())))}
            onFitActive={() => setFitTrigger(v => v + 1)}
            provincesInData={provincesInData}
            onStartSnip={() => setIsSnipping(true)}
            onCaptureFull={(f) => triggerCapture(undefined, f)}
            isCapturing={isCapturing} lastSnapUrl={lastSnapUrl} onGenerateSnap={() => triggerCapture(undefined, 'url')}
            denominators={denominators} categoryTotals={categoryTotals}
          />
          <ProvinceViewControl 
            provinces={provincesInData} hiddenProvinces={hiddenProvinces}
            onToggle={(n) => setHiddenProvinces(p => { const next = new Set(p); if (next.has(n.toUpperCase())) next.delete(n.toUpperCase()); else next.add(n.toUpperCase()); return next; })}
            onFocusProvince={(n) => { setHighlightedProvince(n); setHighlightedMunicipality(null); setFitTrigger(v => v + 1); }}
            highlightedProvince={highlightedProvince}
          />
        </>
      )}
      {isSnipping && <SnippingOverlay onCapture={(r) => triggerCapture(r, 'png')} onCancel={() => setIsSnipping(false)} />}
      {selectedPoint && !isSnipping && (
        <div className="absolute right-6 top-6 bottom-6 w-full max-w-[420px] z-[60] animate-in slide-in-from-right duration-500 exclude-from-screenshot">
          <div className="h-full bg-white border border-slate-200 shadow-2xl rounded-[32px] overflow-hidden">
            <DetailSidebar point={selectedPoint} onClose={() => setSelectedPoint(null)} />
          </div>
        </div>
      )}
      {isUploading && (
        <div className="absolute inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center exclude-from-screenshot">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
            <Activity className="text-indigo-600 animate-pulse" size={40} />
            <div className="text-center"><h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Processing Matrix</h3></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
