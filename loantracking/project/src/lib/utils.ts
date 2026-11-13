import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  const strVal = String(val).replace(/,/g, '');
  const num = parseFloat(strVal);
  return isNaN(num) ? 0 : num;
}

export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
}

// parsing dates like "1/2/2568" (Thai year) or "01/02/2025" or "2025-02-01"
export function parseThaiDate(val: any): Date | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'nan') return null;

  // Try parsing direct ISO first
  const isoDate = new Date(s);
  if (!isNaN(isoDate.getTime()) && s.includes('-')) {
    // Basic check if it's a valid date
    return isoDate;
  }

  // Parse DD/MM/YYYY
  const parts = s.replace(/-/g, '/').split('/');
  if (parts.length === 3) {
    let [d, m, y] = parts;
    let year = parseInt(y, 10);
    if (year > 2400) year -= 543; // Convert Thai Buddhist year to Gregorian
    
    const parsed = new Date(year, parseInt(m, 10) - 1, parseInt(d, 10));
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}
