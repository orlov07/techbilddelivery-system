import type { Category, Product } from '../types';

const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();

const productSignature = (product: Product) => {
  const promoPrice = typeof product.promo_price === 'number' ? product.promo_price.toFixed(2) : '';
  return [
    normalizeText(product.name),
    normalizeText(product.category),
    normalizeText(product.description),
    product.price.toFixed(2),
    promoPrice,
  ].join('::');
};

const compareProducts = (current: Product, candidate: Product) => {
  const currentScore =
    (current.is_active ? 4 : 0) +
    (current.stock_quantity > 0 ? 2 : 0) +
    (current.image_url ? 1 : 0);
  const candidateScore =
    (candidate.is_active ? 4 : 0) +
    (candidate.stock_quantity > 0 ? 2 : 0) +
    (candidate.image_url ? 1 : 0);

  if (candidateScore !== currentScore) {
    return candidateScore > currentScore ? candidate : current;
  }

  const currentCreatedAt = new Date(current.created_at || 0).getTime();
  const candidateCreatedAt = new Date(candidate.created_at || 0).getTime();

  return candidateCreatedAt > currentCreatedAt ? candidate : current;
};

export function dedupeProducts(products: Product[]): Product[] {
  const byId = new Map<string, Product>();

  products.forEach((product) => {
    const existing = byId.get(product.id);
    byId.set(product.id, existing ? compareProducts(existing, product) : product);
  });

  const bySignature = new Map<string, Product>();

  [...byId.values()].forEach((product) => {
    const signature = productSignature(product);
    const existing = bySignature.get(signature);
    bySignature.set(signature, existing ? compareProducts(existing, product) : product);
  });

  return [...bySignature.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function dedupeCategories(categories: Category[]): Category[] {
  const byName = new Map<string, Category>();

  categories.forEach((category) => {
    const key = normalizeText(category.name);
    if (!key || byName.has(key)) return;
    byName.set(key, category);
  });

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

