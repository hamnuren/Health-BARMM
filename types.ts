
export interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
  name: string;
  municipality?: string;
  description?: string;
  value?: number;
  category?: string;
  imageUrl?: string;
  // Dynamic properties from uploaded files
  data?: Record<string, number | string>;
}

export type BaseLayerType = 'standard' | 'satellite' | 'hybrid' | 'dark';

export interface ProvinceStats {
  name: string;
  value: number;
  count: number;
}

export interface RegionData {
  regionName: string;
  value: number;
  color: string;
}

export interface MapSettings {
  center: [number, number];
  zoom: number;
  showBARMMOnly: boolean;
}

export enum FileType {
  CSV = 'csv',
  EXCEL = 'xlsx'
}
