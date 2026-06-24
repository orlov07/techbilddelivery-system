const SAVED_ADDRESSES_KEY = 'tb_saved_addresses_v1';
const MAX_SAVED_ADDRESSES = 5;

const normalizeAddress = (address: string) => address.trim().replace(/\s+/g, ' ');

export function getSavedAddresses(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(SAVED_ADDRESSES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((value) => (typeof value === 'string' ? normalizeAddress(value) : ''))
      .filter(Boolean)
      .slice(0, MAX_SAVED_ADDRESSES);
  } catch {
    return [];
  }
}

function writeSavedAddresses(addresses: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(addresses.slice(0, MAX_SAVED_ADDRESSES)));
}

export function saveAddress(address: string): string[] {
  const normalized = normalizeAddress(address);
  if (!normalized) return getSavedAddresses();

  const next = [normalized, ...getSavedAddresses().filter((item) => item !== normalized)];
  writeSavedAddresses(next);
  return next.slice(0, MAX_SAVED_ADDRESSES);
}

export function removeSavedAddress(address: string): string[] {
  const normalized = normalizeAddress(address);
  const next = getSavedAddresses().filter((item) => item !== normalized);
  writeSavedAddresses(next);
  return next;
}

