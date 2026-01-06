
import { Hospital, Stethoscope, HeartPulse, CircleDot, ShieldPlus } from 'lucide-react';

export const CATEGORY_OPTIONS = ['BHS', 'Hospital', 'RHU', 'Super Health Center', 'Other'];

export const CATEGORY_MAP: Record<string, { icon: any, color: string, lightBg: string }> = {
  'Hospital': { icon: Hospital, color: '#ef4444', lightBg: '#fef2f2' },
  'RHU': { icon: Stethoscope, color: '#10b981', lightBg: '#ecfdf5' },
  'BHS': { icon: HeartPulse, color: '#f59e0b', lightBg: '#fffbeb' },
  'Super Health Center': { icon: ShieldPlus, color: '#db2777', lightBg: '#fdf2f8' },
  'Other': { icon: CircleDot, color: '#64748b', lightBg: '#f8fafc' }
};
