
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

// Refined coordinates to perfectly encompass the full BARMM spread from Tawi-Tawi to Lanao del Sur
const DEFAULT_VIEW = { center: [6.85, 122.2] as [number, number], zoom: 7.1 };

// Centralized normalization for deduplication
const getFacilityFingerprint = (p: GeoPoint): string => {
  let n = p.name.toUpperCase().trim();
  n = n.split(' - ')[0].trim();
  // Remove project noise
  n = n.replace(/CONSTRUCTION OF|REPAIR OF|NEW CONSTRUCTION|PHASE \d+|PHASE|ADMIN BLDG|ADMIN BUILDING|MOTORPOOL/g, '').trim();
  // Standardize common types
  if (n.includes('INTEGRATED PROVINCIAL HEALTH OFFICE')) n = 'IPHO';
  if (n.includes('CITY HEALTH OFFICE')) n = 'CHO';
  if (n.includes('RURAL HEALTH UNIT')) n = 'RHU';
  if (n.includes('BARANGAY HEALTH STATION')) n = 'BHS';
  
  if (n.includes('HOSPITAL')) {
    // Remove hierarchy keywords to find base facility identity
    n = n.replace(/DISTRICT|MUNICIPAL|PROVINCIAL|MEMORIAL|LIPAE|CITY|REGIONAL/g, '');
    n = n.replace(/\s+/g, ' ').trim();
    if (!n.endsWith('HOSPITAL')) n += ' HOSPITAL';
  }
  
  const mun = (p.municipality || p.data?.Municipality || 'UNKNOWN').toString().toUpperCase();
  const prov = (p.data?.Province || p.data?.province || 'BARMM').toString().toUpperCase();
  const cat = (p.category || 'OTHER').toString().toUpperCase();

  return `${n}|${cat}|${mun}|${prov}`;
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

  const handleDataUpdate = async (data: GeoPoint[]) => {
    setIsUploading(true);
    try {
      await savePointsToStorage(data);
      setPoints(data);
    } catch (error) {
      console.error("Failed to save data:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = async () => {
    await clearStorage();
    setPoints([]);
    setSearchQuery('');
    setSelectedPoint(null);
    setHighlightedProvince(null);
    setHighlightedMunicipality(null);
    setHiddenProvinces(new Set());
    setMapView(DEFAULT_VIEW);
    setLastSnapUrl(null);
  };

  const handleResetView = () => {
    setHighlightedProvince(null);
    setHighlightedMunicipality(null);
    setMapView(DEFAULT_VIEW);
    setFitTrigger(prev => prev + 1);
  };

  const toggleProvinceVisibility = (name: string) => {
    const upperName = name.toUpperCase();
    setHiddenProvinces(prev => {
      const next = new Set(prev);
      if (next.has(upperName)) next.delete(upperName);
      else next.add(upperName);
      return next;
    });
  };

  const toggleAllProvincesVisibility = (visible: boolean) => {
    if (visible) {
      setHiddenProvinces(new Set());
    } else {
      setHiddenProvinces(new Set(provincesInData.map(p => p.toUpperCase())));
    }
  };

  const handleProvinceToggle = (prov: string | null) => {
    if (highlightedProvince && prov && highlightedProvince.toUpperCase() === prov.toUpperCase()) {
      setHighlightedProvince(null);
      setHighlightedMunicipality(null);
    } else {
      setHighlightedProvince(prov);
      setHighlightedMunicipality(null);
      setFitTrigger(prev => prev + 1);
    }
  };

  const handleMunicipalitySelect = (mun: string | null) => {
    setHighlightedMunicipality(mun);
    if (mun) setFitTrigger(prev => prev + 1);
  };

  const handleFitActive = () => {
    setFitTrigger(prev => prev + 1);
  };

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

  const filteredPoints = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return points.filter(p => {
      const pProv = (p.data?.Province || p.data?.province || 'Unknown').toString();
      const pMun = (p.municipality || p.data?.Municipality || '').toString();

      if (highlightedProvince) {
        const upperPProv = pProv.toUpperCase();
        const upperHProv = highlightedProvince.toUpperCase();
        const matchesProvince = upperPProv.includes(upperHProv) || upperHProv.includes(upperPProv) || isPointInProvince(p.lat, p.lng, highlightedProvince);
        if (!matchesProvince) return false;
      }

      if (highlightedMunicipality) {
        if (pMun.toUpperCase() !== highlightedMunicipality.toUpperCase()) return false;
      }

      if (hiddenProvinces.has(pProv.toUpperCase())) return false;
      
      const cat = p.category || 'Other';
      if (!selectedCategories.includes(cat)) return false;

      return !query || p.name.toLowerCase().includes(query) || pMun.toLowerCase().includes(query);
    });
  }, [points, selectedCategories, searchQuery, highlightedProvince, highlightedMunicipality, hiddenProvinces]);

  const denominators = useMemo(() => {
    if (highlightedProvince) {
      const ref = BARMM_PROVINCES.find(p => 
        p.name.toUpperCase().includes(highlightedProvince.toUpperCase()) ||
        highlightedProvince.toUpperCase().includes(p.name.toUpperCase())
      );
      if (ref) return { muns: ref.totalMunicipalities, brgys: ref.totalBarangays };
    }

    const activeProvinces = provincesInData.filter(p => !hiddenProvinces.has(p.toUpperCase()));
    let totalMuns = 0;
    let totalBrgys = 0;

    activeProvinces.forEach(provName => {
        const ref = BARMM_PROVINCES.find(p => 
            p.name.toUpperCase().includes(provName.toUpperCase()) ||
            provName.toUpperCase().includes(p.name.toUpperCase())
        );
        if (ref) {
            totalMuns += ref.totalMunicipalities;
            totalBrgys += ref.totalBarangays;
        }
    });

    if (totalMuns > 0) return { muns: totalMuns, brgys: totalBrgys };

    const muns = new Set();
    const brgys = new Set();
    points.forEach(p => {
      const mun = (p.municipality || p.data?.Municipality || 'Unknown').toString();
      const brgy = (p.data?.['Brgy/ Sitio'] || p.data?.Barangay || 'Unknown').toString();
      muns.add(mun);
      brgys.add(brgy);
    });
    return { muns: muns.size || 1, brgys: brgys.size || 1 };
  }, [points, highlightedProvince, hiddenProvinces, provincesInData]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const seenFacilities = new Set<string>();

    filteredPoints.forEach(p => {
      const cat = p.category || 'Other';
      const fingerprint = getFacilityFingerprint(p);
      
      if (!seenFacilities.has(fingerprint)) {
        seenFacilities.add(fingerprint);
        totals[cat] = (totals[cat] || 0) + 1;
      }
    });
    return totals;
  }, [filteredPoints]);

  const triggerCapture = async (rect?: { x: number, y: number, width: number, height: number }, format: 'png' | 'pdf' | 'url' = 'png') => {
    if (isCapturing) return;
    setIsCapturing(true);
    setIsSnipping(false);
    
    const root = document.getElementById('root');
    if (!root) {
      setIsCapturing(false);
      return;
    }

    try {
      await new Promise(r => setTimeout(r, 100));
      const pixelRatio = format === 'url' ? 1.5 : 3;
      
      const options: any = {
        pixelRatio,
        quality: 1,
        filter: (node: HTMLElement) => {
            if (node.classList?.contains('exclude-from-screenshot')) return false;
            return true;
        },
      };

      if (rect) {
        options.width = rect.width;
        options.height = rect.height;
        options.left = rect.x;
        options.top = rect.y;
      }

      const dataUrl = await toPng(root, options);
      
      if (format === 'url') {
        setLastSnapUrl(dataUrl);
        setIsCapturing(false);
        return dataUrl;
      }

      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 400);

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `MindanaoGeo-Insight-${timestamp}`;

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = dataUrl;
      } else {
        const pdf = new jsPDF({
          orientation: root.clientWidth > root.clientHeight ? 'landscape' : 'portrait',
          unit: 'px',
          format: rect ? [rect.width, rect.height] : [root.clientWidth, root.clientHeight]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, rect ? rect.width : root.clientWidth, rect ? rect.height : root.clientHeight, undefined, 'FAST');
        pdf.save(`${filename}.pdf`);
      }
    } catch (err) {
      console.error(err);
      alert('Capture failed.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSearchFocus = (lat: number, lng: number) => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setMapView({ center: [lat, lng], zoom: 14 });
    }
  };

  return (
    <div className={`relative h-screen w-full bg-slate-100 overflow-hidden font-sans ${isSidebarExpanded ? 'sidebar-expanded' : ''}`}>
      {showFlash && <div className="flash-effect" />}
      
      <div className="absolute inset-0 z-0">
        <MapComponent 
          center={mapView.center} zoom={mapView.zoom} points={filteredPoints}
          highlightedProvince={highlightedProvince}
          highlightedMunicipality={highlightedMunicipality}
          showMarkers={showMarkers} showProvinces={showProvinces}
          showLabels={showLabels} showBorders={showBorders}
          onMarkerDoubleClick={(p) => setSelectedPoint(p)}
          onProvinceSelect={handleProvinceToggle}
          onResetView={handleResetView}
          baseLayer={baseLayer}
          setBaseLayer={setBaseLayer}
          categoryTotals={categoryTotals}
          fitTrigger={fitTrigger}
          denominators={denominators}
        />
      </div>

      {!isSnipping && (
        <>
          <AppNavigation 
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onDataUpload={handleDataUpdate}
            onClear={handleClear}
            onSearch={handleSearchFocus}
            onProvinceSelect={handleProvinceToggle}
            onMunicipalitySelect={handleMunicipalitySelect}
            points={points}
            highlightedProvince={highlightedProvince}
            highlightedMunicipality={highlightedMunicipality}
            showMarkers={showMarkers} setShowMarkers={setShowMarkers}
            showProvinces={showProvinces} setShowProvinces={setShowProvinces}
            showLabels={showLabels} setShowLabels={setShowLabels}
            showBorders={showBorders} setShowBorders={setShowBorders}
            availableCategories={availableCategories}
            selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            baseLayer={baseLayer} setBaseLayer={setBaseLayer}
            hiddenProvinces={hiddenProvinces}
            onToggleProvince={toggleProvinceVisibility}
            onToggleAllProvinces={toggleAllProvincesVisibility}
            onFitActive={handleFitActive}
            provincesInData={provincesInData}
            onStartSnip={() => setIsSnipping(true)}
            onCaptureFull={(format) => triggerCapture(undefined, format)}
            isCapturing={isCapturing}
            lastSnapUrl={lastSnapUrl}
            onGenerateSnap={() => triggerCapture(undefined, 'url')}
            denominators={denominators}
            categoryTotals={categoryTotals}
          />

          <ProvinceViewControl 
            provinces={provincesInData}
            hiddenProvinces={hiddenProvinces}
            onToggle={toggleProvinceVisibility}
            onToggleAll={toggleAllProvincesVisibility}
            onFocusProvince={handleProvinceToggle}
            highlightedProvince={highlightedProvince}
          />
        </>
      )}

      {isSnipping && (
        <SnippingOverlay 
          onCapture={(rect) => triggerCapture(rect, 'png')} 
          onCancel={() => setIsSnipping(false)} 
        />
      )}

      {selectedPoint && !isSnipping && (
        <div className="absolute right-6 top-6 bottom-6 w-full max-w-[400px] z-[60] animate-in slide-in-from-right duration-500 exclude-from-screenshot">
          <div className="h-full bg-white border border-slate-200 shadow-2xl rounded-[32px] overflow-hidden">
            <DetailSidebar point={selectedPoint} onClose={() => setSelectedPoint(null)} />
          </div>
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center exclude-from-screenshot">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
            <Activity className="text-indigo-600 animate-pulse" size={40} />
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Processing Intelligence</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Updating Regional Datasets</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
