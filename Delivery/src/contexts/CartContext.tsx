import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Product } from '../types';

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

interface CartContextValue {
  cart: CartItem[];
  cartItemsCount: number;
  addToCart: (product: Product, quantity: number, notes?: string) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
}

const CART_KEY = 'tb_cart';
const CART_TTL = 24 * 60 * 60 * 1000; // 24 hours

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const { items, ts } = JSON.parse(raw);
    if (Date.now() - ts > CART_TTL) return [];
    return items as CartItem[];
  } catch {
    return [];
  }
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(loadCart);

  // Persist on every change
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify({ items: cart, ts: Date.now() }));
  }, [cart]);

  const cartItemsCount = useMemo(() => cart.reduce((n, i) => n + i.quantity, 0), [cart]);

  const addToCart = useCallback((product: Product, quantity: number, notes?: string) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id && i.notes === notes);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        return next;
      }
      return [...prev, { product, quantity, notes }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, quantity } : i));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo(
    () => ({ cart, cartItemsCount, addToCart, removeFromCart, updateCartQuantity, clearCart }),
    [cart, cartItemsCount, addToCart, removeFromCart, updateCartQuantity, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
