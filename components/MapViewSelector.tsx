
import React from 'react';
import { BaseLayerType } from '../types';

// This component is now integrated into the MapComponent footer
// Keeping it empty or very minimal if referenced elsewhere by accident.
interface MapViewSelectorProps {
  current: BaseLayerType;
  onSelect: (layer: BaseLayerType) => void;
  isSidebarExpanded?: boolean;
}

const MapViewSelector: React.FC<MapViewSelectorProps> = () => {
  return null;
};

export default MapViewSelector;
