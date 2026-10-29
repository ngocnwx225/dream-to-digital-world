import { useEffect, useState } from "react";
import { useSettings } from "@/lib/data";

export const DEFAULT_BRAND_NAME = "Chơi Xe-Xe Chơi";
export const DEFAULT_LOGO = "/logo.png";
/** Approximation of the built-in primary (oklch 0.565 0.235 264), shown by the colour picker when none is saved. */
export const DEFAULT_BRAND_COLOR = "#3b5bdb";

export const DEFAULT_BRAND_SUBTITLE = "Quản lý mua bán & tồn kho";

export type Brand = { name: string; subtitle: string; logo: string; color: string | null };

const CACHE_KEY = "brand-config";
const HEX = /^#[0-9a-f]{6}$/i;

// Databases created before the rename still hold the old default name.
const LEGACY_NAMES = new Set(["", "StoreFlow"]);

export function resolveBrand(s?: {
  store_name?: string | null; brand_subtitle?: string | null; logo_url?: string | null; brand_color?: string | null;
} | null): Brand {
  const name = (s?.store_name ?? "").trim();
  return {
    name: LEGACY_NAMES.has(name) ? DEFAULT_BRAND_NAME : name,
    subtitle: s?.brand_subtitle == null ? DEFAULT_BRAND_SUBTITLE : s.brand_subtitle.trim(),
    logo: s?.logo_url || DEFAULT_LOGO,
    color: s?.brand_color && HEX.test(s.brand_color) ? s.brand_color : null,
  };
}

/** Last known brand, so the login screen (no database access) and first paint match the saved settings. */
export function readBrandCache(): Brand {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return resolveBrand(JSON.parse(raw));
  } catch { /* storage unavailable: use defaults */ }
  return resolveBrand(null);
}

function writeBrandCache(b: Brand) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ store_name: b.name, brand_subtitle: b.subtitle, logo_url: b.logo === DEFAULT_LOGO ? null : b.logo, brand_color: b.color }));
  } catch { /* quota or unavailable: ignore */ }
}

function hexToOklch(hex: string): [number, number, number] {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [lin(1), lin(3), lin(5)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return [L, Math.hypot(A, B), h < 0 ? h + 360 : h];
}

const VARS = ["--primary", "--primary-strong", "--ring", "--sidebar-primary", "--shadow-glow"] as const;

/** Overrides the theme tokens derived from the primary colour; `null` restores the stylesheet values. */
export function applyBrandColor(color: string | null) {
  const root = document.documentElement.style;
  if (!color) return VARS.forEach((v) => root.removeProperty(v));
  const [L, C, H] = hexToOklch(color);
  const f = (n: number) => n.toFixed(3);
  const primary = `oklch(${f(L)} ${f(C)} ${f(H)})`;
  root.setProperty("--primary", primary);
  root.setProperty("--ring", primary);
  root.setProperty("--sidebar-primary", primary);
  root.setProperty("--primary-strong", `oklch(${f(Math.max(0, L - 0.085))} ${f(C)} ${f((H + 6) % 360)})`);
  root.setProperty("--shadow-glow", `0 6px 18px -6px oklch(${f(L)} ${f(C)} ${f(H)} / 0.55)`);
}

/** Brand for the pre-login screen: defaults on the server render, then the cached copy once mounted (avoids a hydration mismatch). */
export function useCachedBrand(): Brand {
  const [brand, setBrand] = useState<Brand>(() => resolveBrand(null));
  useEffect(() => {
    const b = readBrandCache();
    setBrand(b);
    applyBrandColor(b.color);
  }, []);
  return brand;
}

/** Current brand for authenticated screens; falls back to the cached copy while settings load. */
export function useBrand(): Brand {
  const { data } = useSettings();
  return data ? resolveBrand(data) : readBrandCache();
}

/** Mount once in the app layout: applies the colour and refreshes the cache whenever settings change. */
export function useBrandEffect() {
  const { data } = useSettings();
  useEffect(() => {
    const b = data ? resolveBrand(data) : readBrandCache();
    applyBrandColor(b.color);
    if (data) writeBrandCache(b);
    // Browser-tab icon follows the custom logo; the bundled favicon stays when none is set.
    if (b.logo !== DEFAULT_LOGO) {
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((l) => { l.href = b.logo; l.type = "image/png"; });
    }
  }, [data]);
}
