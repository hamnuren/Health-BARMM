
export interface ProvinceZone {
  name: string;
  psgc: string;
  polygons: [number, number][][];
  color: string;
  description: string;
  totalMunicipalities: number;
  totalBarangays: number;
}

export const BARMM_PROVINCES: ProvinceZone[] = [
  {
    name: "Maguindanao del Norte",
    psgc: "1908700000",
    color: "#1e40af", 
    description: "Centering around Cotabato City and Parang.",
    totalMunicipalities: 13, 
    totalBarangays: 249,
    polygons: [[[7.14, 124.08], [7.45, 124.01], [7.62, 124.22], [7.65, 124.45], [7.14, 124.08]]]
  },
  {
    name: "Maguindanao del Sur",
    psgc: "1908800000",
    color: "#7e22ce", 
    description: "The southern heartland featuring the Liguasan Marsh.",
    totalMunicipalities: 24,
    totalBarangays: 287,
    polygons: [[[6.50, 124.45], [6.95, 125.02], [7.10, 124.65], [6.50, 124.45]]]
  },
  {
    name: "SGA",
    psgc: "1900000000-SGA",
    color: "#be123c",
    description: "Special Geographic Area: Clusters of barangays in North Cotabato that opted to join BARMM.",
    totalMunicipalities: 8, 
    totalBarangays: 63,
    polygons: [[[7.15, 124.45], [7.35, 124.85], [7.05, 124.95], [7.15, 124.45]]]
  },
  {
    name: "Lanao del Sur",
    psgc: "1903600000",
    color: "#16a34a",
    description: "The majestic lake region.",
    totalMunicipalities: 40, 
    totalBarangays: 1159, 
    polygons: [[[7.52, 124.32], [8.02, 124.05], [8.45, 124.62], [7.52, 124.32]]]
  },
  {
    name: "Basilan",
    psgc: "1900700000",
    color: "#0284c7",
    description: "The island province.",
    totalMunicipalities: 13,
    totalBarangays: 255,
    polygons: [[[6.42, 122.05], [7.02, 122.12], [6.50, 122.35], [6.42, 122.05]]]
  },
  {
    name: "Sulu",
    psgc: "1906600000",
    color: "#ea580c",
    description: "The archipelago province.",
    totalMunicipalities: 19,
    totalBarangays: 410,
    polygons: [[[5.85, 120.90], [6.20, 121.20], [5.90, 121.40], [5.85, 120.90]]]
  },
  {
    name: "Tawi-Tawi",
    psgc: "1907000000",
    color: "#0d9488",
    description: "The southernmost frontier.",
    totalMunicipalities: 11,
    totalBarangays: 203,
    polygons: [[[4.95, 119.75], [5.30, 120.20], [5.10, 120.40], [4.95, 119.75]]]
  }
];

export const isPointInProvince = (lat: number, lng: number, provinceName: string): boolean => {
  const province = BARMM_PROVINCES.find(p => p.name.toUpperCase().includes(provinceName.toUpperCase()) || provinceName.toUpperCase().includes(p.name.toUpperCase()));
  if (!province) return false;
  
  return province.polygons.some(polygon => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  });
};
