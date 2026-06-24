import type { CartItem } from '../contexts/CartContext';
import type { Product } from '../types';

const FAVORITES_KEY = 'tb_favorite_products';
const ORDER_HISTORY_KEY = 'tb_order_history_v1';
const MAX_HISTORY_ITEMS = 30;

type StoredOrderItem = {
  id: string;
  name: string;
  quantity: number;
  orderedAt: string;
};

type StoredOrder = {
  orderedAt: string;
  items: StoredOrderItem[];
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getFavoriteProductIds(): string[] {
  return readJson<string[]>(FAVORITES_KEY, []);
}

export function toggleFavoriteProduct(productId: string): string[] {
  const current = getFavoriteProductIds();
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [productId, ...current];

  writeJson(FAVORITES_KEY, next);
  return next;
}

export function recordCompletedOrder(cart: CartItem[]) {
  const current = readJson<StoredOrder[]>(ORDER_HISTORY_KEY, []);
  const nextEntry: StoredOrder = {
    orderedAt: new Date().toISOString(),
    items: cart.map((item) => ({
      id: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      orderedAt: new Date().toISOString(),
    })),
  };

  writeJson(ORDER_HISTORY_KEY, [nextEntry, ...current].slice(0, MAX_HISTORY_ITEMS));
}

export function getTopPurchasedProducts(products: Product[], limit = 6): Product[] {
  const history = readJson<StoredOrder[]>(ORDER_HISTORY_KEY, []);
  const score = new Map<string, number>();

  history.forEach((order) => {
    order.items.forEach((item) => {
      score.set(item.id, (score.get(item.id) ?? 0) + item.quantity);
    });
  });

  return [...products]
    .filter((product) => (score.get(product.id) ?? 0) > 0 && product.is_active && product.stock_quantity > 0)
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))
    .slice(0, limit);
}

export function getFavoriteProducts(products: Product[]): Product[] {
  const favoriteIds = new Set(getFavoriteProductIds());
  return products.filter((product) => favoriteIds.has(product.id));
}
