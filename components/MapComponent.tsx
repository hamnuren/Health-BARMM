
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { GeoPoint, BaseLayerType } from '../types';
import { BARMM_PROVINCES } from '../constants/provinces';
import { CATEGORY_MAP } from '../constants/mapConfig';
import { Globe, Moon, Cloud, Navigation2, Plus, Minus, Target } from 'lucide-react';

interface MapComponentProps {
  center: [number, number];
  zoom: number;
  points: GeoPoint[];
  highlightedProvince?: string | null;
  highlightedMunicipality?: string | null;
  filterLevel?: 'region' | 'province';
  showMarkers?: boolean;
  showProvinces?: boolean;
  showLabels?: boolean;
  showBorders?: boolean;
  showNameMarkers?: boolean;
  onMarkerDoubleClick?: (point: GeoPoint) => void;
  onProvinceSelect?: (name: string | null) => void;
  onResetView?: () => void;
  baseLayer?: BaseLayerType;
  setBaseLayer?: (layer: BaseLayerType) => void;
  categoryTotals?: Record<string, number>;
  fitTrigger?: number;
  denominators?: { muns: number, brgys: number };
}

const REGION_GEOJSON_URL = "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/2023/geojson/regions/hires/provdists-region-1900000000.0.1.json";

const getCategorySVG = (category: string) => {
  switch (category) {
    case 'Hospital': return '<path d="M21 15V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9"/><path d="M21 9H3"/><path d="M16 5V4a1 1 0 0 0-1-1H9a1 1 0 0 0-1-1v1"/><path d="M12 11v4"/><path d="M10 13h4"/><path d="M2 19h20"/>';
    case 'RHU': return '<path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 0-2.8 0L2 16"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M12 18v.01"/>';
    case 'BHS': return '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 7v4"/><path d="M10 9h4"/>';
    case 'Office': return '<path d="M17 21v-2a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2"/><path d="M19 21H5a1 1 0 0 1-1-1V5a1 1 0 0 1-1-1h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1z"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h6"/>';
    case 'Super Health Center': return '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 8.24-3.99a1 1 0 0 1 1.51 0C18.5 3.8 21 5 23 5a1 1 0 0 1 1-1v7z"/><path d="M12 9v6"/><path d="M9 12h6"/>';
    default: return '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="12" r="10"/>';
  }
};

const DEFAULT_LEGEND_POS = { bottom: 40, right: 16 };

const MapComponent: React.FC<MapComponentProps> = ({ 
  center, zoom, points, highlightedProvince, highlightedMunicipality,
  showMarkers = true, showProvinces = true, showLabels = true, showBorders = true, showNameMarkers = false, onMarkerDoubleClick,
  onProvinceSelect, onResetView, baseLayer = 'standard', setBaseLayer, categoryTotals = {}, fitTrigger = 0,
  denominators = { muns: 0, brgys: 0 }
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const provinceLayerRef = useRef<L.GeoJSON | null>(null);
  const tileLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const [regionData, setRegionData] = useState<any>(null);
  
  const [scaleLabel, setScaleLabel] = useState('2 km');
  const [scaleWidth, setScaleWidth] = useState(80);

  const [isDragging, setIsDragging] = useState(false);
  const [legendPos, setLegendPos] = useState(DEFAULT_LEGEND_POS);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialRight: number; initialBottom: number } | null>(null);

  useEffect(() => {
    fetch(REGION_GEOJSON_URL).then(res => res.json()).then(setRegionData).catch(console.error);
  }, []);

  const handleLegendMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialRight: legendPos.right,
      initialBottom: legendPos.bottom
    };
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const deltaX = dragStartRef.current.mouseX - e.clientX;
    const deltaY = dragStartRef.current.mouseY - e.clientY;
    setLegendPos({
      right: dragStartRef.current.initialRight + deltaX,
      bottom: dragStartRef.current.initialBottom + deltaY
    });
  }, [isDragging]);

  const handleGlobalMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    } else {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, handleGlobalMouseMove, handleGlobalMouseUp]);

  const resetLegendPosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLegendPos(DEFAULT_LEGEND_POS);
  };

  const isProvinceMatch = (name1: string, name2: string) => {
    const u1 = (name1 || '').toUpperCase();
    const u2 = (name2 || '').toUpperCase();
    if (u1 === u2) return true;
    if (u1.includes(u2) || u2.includes(u1)) return true;
    const isSGA1 = u1.includes("SPECIAL GEOGRAPHIC AREA") || u1 === "SGA";
    const isSGA2 = u2.includes("SPECIAL GEOGRAPHIC AREA") || u2 === "SGA";
    return isSGA1 && isSGA2;
  };

  const isValidLatLng = (lat: any, lng: any) => {
    return typeof lat === 'number' && typeof lng === 'number' && 
           !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng);
  };

  const updateScale = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const y = map.getSize().y / 2;
    const maxMeters = map.distance(map.containerPointToLatLng([0, y]), map.containerPointToLatLng([100, y]));
    
    const roundNumber = (n: number) => {
      const pow10 = Math.pow(10, Math.floor(Math.log10(n)));
      const ratio = n / pow10;
      let res;
      if (ratio >= 5) res = 5;
      else if (ratio >= 2) res = 2;
      else res = 1;
      return res * pow10;
    };

    const targetDistance = roundNumber(maxMeters);
    const pxWidth = (targetDistance / maxMeters) * 100;

    setScaleWidth(pxWidth);
    setScaleLabel(targetDistance >= 1000 ? `${targetDistance / 1000} km` : `${targetDistance} m`);
  }, []);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const startCenter: L.LatLngExpression = isValidLatLng(center[0], center[1]) 
        ? center 
        : [6.85, 122.2];

      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, 
        attributionControl: false, 
        preferCanvas: false,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 120
      }).setView(startCenter, zoom);

      tileLayerGroupRef.current = L.layerGroup().addTo(mapRef.current);
      
      mapRef.current.on('move zoom', updateScale);
      updateScale();

      mapRef.current.on('click', (e) => {
        const target = e.originalEvent.target as HTMLElement;
        if (target.classList.contains('leaflet-tile-container') || target.id === mapContainerRef.current?.id) {
          onProvinceSelect?.(null);
        }
      });

      const ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.invalidateSize(); });
      ro.observe(mapContainerRef.current);
      return () => ro.disconnect();
    }
  }, [updateScale]);

  useEffect(() => {
    if (!mapRef.current || fitTrigger === 0) return;

    if (highlightedMunicipality) {
      const munPoints = points.filter(p => {
        const pMun = (p.municipality || p.data?.Municipality || '').toString().toUpperCase();
        return pMun === highlightedMunicipality.toUpperCase();
      });
      if (munPoints.length > 0) {
        const bounds = L.latLngBounds(munPoints.map(p => [p.lat, p.lng]));
        mapRef.current.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
      }
    } else if (highlightedProvince && provinceLayerRef.current) {
      let found = false;
      provinceLayerRef.current.eachLayer((layer: any) => {
        const provName = layer.feature?.properties?.adm2_en || 'Special Geographic Area';
        if (isProvinceMatch(provName, highlightedProvince)) {
          mapRef.current?.flyToBounds(layer.getBounds(), { padding: [40, 40], duration: 1.2 });
          found = true;
        }
      });
      if (!found) {
        const provPoints = points.filter(p => {
          const pProv = (p.data?.Province || p.data?.province || 'Unknown').toString().toUpperCase();
          return pProv.includes(highlightedProvince.toUpperCase());
        });
        if (provPoints.length > 0) {
          const bounds = L.latLngBounds(provPoints.map(p => [p.lat, p.lng]));
          mapRef.current.flyToBounds(bounds, { padding: [100, 100], duration: 1.2 });
        }
      }
    } else if (provinceLayerRef.current) {
      const bounds = provinceLayerRef.current.getBounds();
      if (bounds.isValid()) {
         mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 1.5 });
      }
    }
  }, [fitTrigger]);

  useEffect(() => {
    if (mapRef.current) {
      if (isValidLatLng(center[0], center[1])) {
        mapRef.current.flyTo(center, zoom, { duration: 1.5 });
      }
    }
  }, [center, zoom]);

  useEffect(() => {
    if (!mapRef.current || !tileLayerGroupRef.current) return;
    tileLayerGroupRef.current.clearLayers();
    const urls: Record<BaseLayerType, string> = {
      standard: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
      dark: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      hybrid: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    };
    L.tileLayer(urls[baseLayer], { maxZoom: 19, crossOrigin: true }).addTo(tileLayerGroupRef.current);
  }, [baseLayer]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (labelLayerRef.current) labelLayerRef.current.remove();
    if (showLabels) {
      const url = baseLayer === 'dark' ? 
        'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png' : 
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png';
      labelLayerRef.current = L.tileLayer(url, { zIndex: 1000, crossOrigin: true }).addTo(mapRef.current);
    }
  }, [showLabels, baseLayer]);

  useEffect(() => {
    if (!mapRef.current || !regionData) return;
    if (provinceLayerRef.current) provinceLayerRef.current.remove();

    const getProvinceByName = (name: string) => {
      if (!name) return undefined;
      const upper = name.toUpperCase();
      if (upper.includes("SPECIAL GEOGRAPHIC AREA") || upper === "SGA") {
        return BARMM_PROVINCES.find(p => p.name === "SGA");
      }
      if (upper === "MAGUINDANAO") return BARMM_PROVINCES.find(p => p.name.includes("del Sur"));
      return BARMM_PROVINCES.find(p => {
        const pUpper = p.name.toUpperCase();
        return upper.includes(pUpper) || pUpper.includes(upper);
      });
    };

    const hasAnySelection = !!highlightedProvince || !!highlightedMunicipality;

    provinceLayerRef.current = L.geoJSON(regionData, {
      style: (feature): L.PathOptions => {
        const provName = feature?.properties?.adm2_en || 'Special Geographic Area';
        const province = getProvinceByName(provName);
        const isFocused = highlightedProvince && isProvinceMatch(provName, highlightedProvince);
        const finalFillOpacity = isFocused ? 0.8 : (hasAnySelection ? 0 : 0.15);
        const finalStrokeOpacity = isFocused ? 1 : (hasAnySelection ? 0 : 1);

        return {
          fillColor: showProvinces ? (province?.color || '#cbd5e1') : 'transparent',
          fillOpacity: finalFillOpacity,
          color: showBorders ? (province?.color || '#cbd5e1') : 'transparent',
          opacity: finalStrokeOpacity,
          weight: isFocused ? 2.2 : 1.5,
          dashArray: isFocused ? '' : '4, 4',
          className: 'province-polygon transition-all duration-300'
        };
      },
      onEachFeature: (feature, layer) => {
        const provName = feature?.properties?.adm2_en || 'Special Geographic Area';
        layer.on({
          mouseover: (e) => {
            if (hasAnySelection) return;
            const l = e.target;
            l.setStyle({ fillOpacity: 0.35, weight: 2.5, color: '#4f46e5' });
            l.bringToFront();
          },
          mouseout: (e) => {
            if (hasAnySelection) return;
            provinceLayerRef.current?.resetStyle(e.target);
          },
          click: (e) => {
            if (highlightedProvince && isProvinceMatch(provName, highlightedProvince)) {
              onProvinceSelect?.(null);
            } else {
              onProvinceSelect?.(provName);
            }
            L.DomEvent.stopPropagation(e);
          }
        });

        layer.bindTooltip(`
          <div class="px-2 py-1">
            <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">Province</div>
            <div class="text-[11px] font-black text-slate-800">${provName}</div>
          </div>
        `, { sticky: true, className: 'studio-glass-tooltip border-none shadow-xl rounded-lg' });
      }
    }).addTo(mapRef.current);
  }, [regionData, highlightedProvince, highlightedMunicipality, showProvinces, showBorders]);

  useEffect(() => {
    if (!mapRef.current) return;
    Object.keys(markersRef.current).forEach(id => markersRef.current[id].remove());
    markersRef.current = {};
    if (showMarkers) {
      points.forEach(point => {
        if (!isValidLatLng(point.lat, point.lng)) return;
        const config = CATEGORY_MAP[point.category || 'Other'] || CATEGORY_MAP['Other'];
        const isCritical = point.category === 'Hospital';
        const markerSize = isCritical ? 16 : 12;

        const isHighlightedMun = highlightedMunicipality && 
          (point.municipality || point.data?.Municipality || '').toString().toUpperCase() === highlightedMunicipality.toUpperCase();
        
        const icon = L.divIcon({
          className: 'custom-marker-container',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="relative" style="background-color: ${config.color}; width: ${markerSize}px; height: ${markerSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4); transform: translateZ(0);">
                <svg width="${isCritical ? 8 : 6}" height="${isCritical ? 8 : 6}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                  ${getCategorySVG(point.category || 'Other')}
                </svg>
              </div>
            </div>`,
          iconSize: [markerSize, markerSize], 
          iconAnchor: [markerSize / 2, markerSize / 2]
        });

        const marker = L.marker([point.lat, point.lng], { icon, riseOnHover: true, zIndexOffset: isCritical ? 2000 : 0 })
          .on('dblclick', () => onMarkerDoubleClick?.(point))
          .addTo(mapRef.current!);

        // UPDATED TOOLTIP LOGIC: Micro-labels for permanent view to prevent collisions
        // The permanent state is controlled by either showNameMarkers (Global) or isHighlightedMun (Local)
        const isPermanent = !!showNameMarkers || !!isHighlightedMun;
        const tooltipHtml = isPermanent ? `
          <div class="micro-label-wrapper">
            <div class="text-[6.5px] font-black text-slate-800 uppercase tracking-tighter truncate max-w-[70px]">
              ${point.name}
            </div>
          </div>
        ` : `
          <div class="flex items-center gap-3 p-1 min-w-[140px]">
            <div class="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
               <img src="https://picsum.photos/seed/${point.id}/100/100" class="w-full h-full object-cover" />
            </div>
            <div>
              <div class="text-[8px] font-black uppercase text-slate-400 leading-none mb-1">${point.category}</div>
              <div class="text-[10px] font-black text-slate-800 leading-tight">${point.name}</div>
            </div>
          </div>
        `;

        const tooltipOptions: L.TooltipOptions = {
          direction: 'top', 
          offset: [0, -markerSize / 2], 
          className: `studio-glass-tooltip border-none shadow-2xl rounded-xl ${isPermanent ? 'micro-label-mode' : ''}`,
          permanent: isPermanent, 
          sticky: !isPermanent
        };

        marker.bindTooltip(tooltipHtml, tooltipOptions);
        
        markersRef.current[point.id] = marker;
      });
    }
  }, [points, showMarkers, onMarkerDoubleClick, highlightedMunicipality, showNameMarkers]);

  const isDarkStyle = baseLayer === 'dark' || baseLayer === 'satellite' || baseLayer === 'hybrid';

  const legendStyles = useMemo(() => {
    if (isDarkStyle) {
      return {
        container: "bg-slate-900/85 border-white/10 shadow-[0_12px_24px_rgba(0,0,0,0.5)]",
        header: "text-white/50",
        label: "text-white/90",
        count: "text-indigo-400"
      };
    }
    return {
      container: "bg-white/90 border-slate-200 shadow-[0_8px_16px_rgba(0,0,0,0.1)]",
      header: "text-slate-400",
      label: "text-slate-700",
      count: "text-indigo-600"
    };
  }, [isDarkStyle]);

  const sortedCategories = useMemo(() => {
    return Object.entries(categoryTotals || {})
      .filter(([_, count]) => (count as number) > 0)
      .sort((a, b) => (b[1] as number) - (a[1] as number));
  }, [categoryTotals]);

  const mapStyles: { id: BaseLayerType; icon: any; label: string }[] = [
    { id: 'standard', icon: Globe, label: 'Map' },
    { id: 'satellite', icon: Cloud, label: 'Sat' },
    { id: 'hybrid', icon: Navigation2, label: 'Hyb' },
    { id: 'dark', icon: Moon, label: 'Dark' }
  ];

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();

  return (
    <div className="w-full h-full relative group">
      <div ref={mapContainerRef} className="w-full h-full relative z-0" style={{ background: '#f1f5f9' }} />
      
      <div 
        onMouseDown={handleLegendMouseDown}
        onDoubleClick={resetLegendPosition}
        style={{ 
          bottom: `${legendPos.bottom}px`, 
          right: `${legendPos.right}px`, 
          transition: isDragging ? 'none' : 'all 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        className={`absolute z-[1000] p-4 backdrop-blur-xl border rounded-[28px] pointer-events-auto opacity-0 group-hover:opacity-100 min-w-[160px] max-h-[80%] overflow-y-auto custom-scrollbar select-none ${legendStyles.container}`}
      >
        <div className={`text-[7.5px] font-black uppercase tracking-[0.2em] mb-3.5 flex items-center gap-2 pointer-events-none ${legendStyles.header}`}>
          <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
          Infrastructure Index
        </div>
        <div className="grid grid-cols-1 gap-2 pointer-events-none">
          {sortedCategories.map(([name, count]) => {
            const config = CATEGORY_MAP[name] || CATEGORY_MAP['Other'];
            let displayCountStr = (count as number).toString();
            let displayLabel = name;
            let tooltipStr = `${count} total facilities`;
            
            if (name === 'BHS') {
              displayLabel = 'BHS';
              displayCountStr = `${count} / ${denominators.brgys}`;
              tooltipStr = `no. of BHS: ${count} / total no. of local barangay within: ${denominators.brgys}`;
            } else if (name === 'RHU') {
              displayLabel = 'RHU';
              displayCountStr = `${count} / ${denominators.muns}`;
              tooltipStr = `no. of RHU: ${count} / total no. of local municipality within: ${denominators.muns}`;
            }

            return (
              <div key={name} className="flex items-center justify-between gap-6 group/item" title={tooltipStr}>
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full ring-2 ring-white/10 shadow-xs" style={{ backgroundColor: config.color }}></div>
                  <span className={`text-[8px] font-black uppercase tracking-tight truncate max-w-[100px] ${legendStyles.label}`}>
                    {displayLabel}
                  </span>
                </div>
                <span className={`text-[8.5px] font-black tabular-nums min-w-[14px] text-right ${legendStyles.count}`}>{displayCountStr}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[1001] h-[22px] bg-white/90 backdrop-blur-sm border-t border-slate-300 flex items-center justify-between px-2 text-[10px] text-slate-700 font-sans pointer-events-auto select-none">
        <div className="flex items-center gap-4 overflow-hidden whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">ahniem ©2025</span>
            <span className="text-slate-300">|</span>
            <span className="hover:underline cursor-pointer">Map data ©2025 Google</span>
            <span className="hover:underline cursor-pointer">Philippines</span>
          </div>
          <div className="flex items-center gap-3 ml-2 border-l border-slate-200 pl-3">
            <span className="hover:underline cursor-pointer">Terms</span>
            <span className="hover:underline cursor-pointer">Privacy</span>
            <span className="hover:underline cursor-pointer">Feedback</span>
          </div>
        </div>
        
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-0.5 border-r border-slate-200 pr-4 h-[18px]">
            {mapStyles.map((style) => (
              <button
                key={style.id}
                onClick={() => setBaseLayer?.(style.id)}
                className={`flex items-center gap-1 px-1.5 h-full rounded transition-all duration-200 hover:bg-slate-100 ${baseLayer === style.id ? 'bg-indigo-600 text-white font-black' : 'text-slate-600'}`}
                title={style.label}
              >
                <style.icon size={10} />
                <span className="text-[8px] uppercase">{style.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-100/60 rounded border border-slate-200 overflow-hidden h-[18px]">
            <button onClick={onResetView} className="px-2 h-full hover:bg-slate-200 flex items-center justify-center border-r border-slate-200"><Target size={10} strokeWidth={3} /></button>
            <button onClick={handleZoomOut} className="px-2 h-full hover:bg-slate-200 flex items-center justify-center border-r border-slate-200"><Minus size={10} strokeWidth={3} /></button>
            <button onClick={handleZoomIn} className="px-2 h-full hover:bg-slate-200 flex items-center justify-center"><Plus size={10} strokeWidth={3} /></button>
          </div>

          <div className="flex items-center gap-2 pr-1 h-[18px]">
            <span className="font-bold text-slate-900 text-[9px]">{scaleLabel}</span>
            <div className="relative h-full flex items-center">
              <div className="border-x border-b border-slate-900 h-[4px] transition-all duration-300 ease-out" style={{ width: `${scaleWidth}px` }}></div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .studio-glass-tooltip {
          background: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          pointer-events: none;
        }
        .micro-label-mode {
          padding: 0 !important;
          border-radius: 2px !important;
          min-width: 0 !important;
          background: rgba(255, 255, 255, 0.7) !important;
          border: 1px solid rgba(0, 0, 0, 0.1) !important;
        }
        .micro-label-wrapper {
          padding: 1px 3px;
          line-height: 1;
        }
        .province-polygon {
          transition: fill-opacity 0.4s ease, stroke-width 0.4s ease, color 0.4s ease, opacity 0.4s ease;
        }
        .custom-marker-container:hover {
          transform: scale(1.3);
          z-index: 5000;
        }
        .leaflet-tooltip-pane .leaflet-tooltip.studio-glass-tooltip {
          z-index: 1000;
        }
      `}</style>
    </div>
  );
};

export default MapComponent;
