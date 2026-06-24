/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { Flame, Info, CheckCircle2, LoaderCircle, Heart, Sparkles } from 'lucide-react';
import { Product, AppSettings } from '../types';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { getFavoriteProductIds, getTopPurchasedProducts, toggleFavoriteProduct } from '../utils/customerInsights';

interface ClientMenuProps {
  products: Product[];
  categories: string[];
  settings: AppSettings;
  addToCart: (product: Product, quantity: number, notes?: string) => void;
  searchQuery: string;
}

const fallbackImage = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=50&w=400';

const optimizeImageUrl = (url?: string, width = 800) => {
  if (!url || !url.startsWith('http')) return fallbackImage;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}w=${width}&q=80`;
};

export default function ClientMenu({
  products,
  categories,
  settings,
  addToCart,
  searchQuery,
}: ClientMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteProductIds());
  const addToCartAction = useAsyncAction();
  const topPurchasedProducts = useMemo(() => getTopPurchasedProducts(products), [products]);
  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteIds.includes(product.id) && product.is_active),
    [favoriteIds, products],
  );

  const filteredProducts = products.filter((product) => {
    if (!product.is_active) return false;
    const matchesCategory =
      selectedCategory === 'Todos' ||
      (selectedCategory === '__favorites__' ? favoriteIds.includes(product.id) : product.category === selectedCategory);
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setItemNotes('');
    addToCartAction.reset();
  };

  const handleConfirmAddToCart = async () => {
    if (!selectedProduct) return;

    await addToCartAction.execute(async () => {
      addToCart(selectedProduct, quantity, itemNotes);
      setSelectedProduct(null);
    });
  };

  const handleToggleFavorite = (productId: string) => {
    setFavoriteIds(toggleFavoriteProduct(productId));
  };

  const renderProductCard = (product: Product, highlight?: string, sectionId = 'catalog') => {
    const hasPromo = product.is_promo && product.promo_price && product.promo_price < product.price;
    const isFavorite = favoriteIds.includes(product.id);

    return (
      <div
        id={`product-card-${sectionId}-${product.id}`}
        key={product.id}
        className="group relative flex w-full max-w-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40 transition hover:border-neutral-700"
      >
        <div className="relative h-44 overflow-hidden bg-neutral-950">
          <img
            referrerPolicy="no-referrer"
            src={optimizeImageUrl(product.image_url)}
            alt={product.name}
            loading="lazy"
            decoding="async"
            width="400"
            height="300"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackImage;
            }}
          />

          <button
            type="button"
            aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            onClick={(event) => {
              event.stopPropagation();
              handleToggleFavorite(product.id);
            }}
            className={`absolute left-2.5 top-2.5 z-10 rounded-full border p-2 transition ${
              isFavorite
                ? 'border-rose-400/40 bg-rose-500/20 text-rose-300'
                : 'border-neutral-700/80 bg-black/45 text-neutral-300 hover:text-white'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {highlight ? (
            <div className="absolute bottom-2.5 left-2.5 rounded-md border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-200 shadow">
              {highlight}
            </div>
          ) : null}

          {hasPromo && (
            <div className="absolute right-2.5 top-2.5 rounded-md bg-orange-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
              Oferta
            </div>
          )}

          {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
            <div className="absolute bottom-2.5 right-2.5 max-w-[calc(100%-1.25rem)] rounded bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-950">
              Poucas Unidades ({product.stock_quantity})
            </div>
          )}

          {product.stock_quantity === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <span className="rounded-md border border-red-500/20 bg-red-950/20 px-3 py-1.5 text-sm font-bold uppercase tracking-widest text-red-400">
                Esgotado
              </span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-5">
          <div className="flex-1">
            <span className="mb-2 inline-block rounded-md bg-orange-950/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-orange-500/80">
              {product.category}
            </span>
            <h3 className="text-[16px] font-bold leading-snug text-white transition-colors group-hover:text-orange-400">
              {product.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-relaxed text-neutral-400">
              {product.description}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-4">
            <div className="flex min-w-0 flex-col">
              {hasPromo ? (
                <>
                  <span className="text-[11px] text-neutral-500 line-through">R$ {product.price.toFixed(2).replace('.', ',')}</span>
                  <span className="text-lg font-bold text-orange-400">R$ {product.promo_price!.toFixed(2).replace('.', ',')}</span>
                </>
              ) : (
                <span className="text-lg font-bold text-white">R$ {product.price.toFixed(2).replace('.', ',')}</span>
              )}
            </div>

            <button
              id={`add-btn-${sectionId}-${product.id}`}
              disabled={product.stock_quantity === 0}
              onClick={() => handleOpenProduct(product)}
              className="max-w-full rounded-xl bg-neutral-800 px-4 py-2 text-xs font-medium text-white transition duration-250 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-neutral-800"
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="client-menu-container" className="w-full max-w-full space-y-6 overflow-x-hidden">
      {!settings.is_open && (
        <div id="establishment-closed-banner" className="flex items-start gap-3 rounded-xl border border-red-850 bg-red-950/60 p-4 text-red-200">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div>
            <h4 className="font-semibold text-red-100">Estabelecimento Fechado</h4>
            <p className="text-sm text-red-300">
              No momento estamos fora do horario de funcionamento ({settings.business_hours}). Voce pode navegar pelo cardapio, mas o fechamento de pedidos esta desabilitado.
            </p>
          </div>
        </div>
      )}

      <div id="hero-promo-container" className="relative flex h-44 w-full max-w-full items-center overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-5 md:p-8">
        <div className="absolute inset-0 z-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${optimizeImageUrl(settings.banner_url || fallbackImage, 1200)})` }} />
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-black via-black/80 to-transparent" />
        <div className="relative z-20 max-w-md min-w-0">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-orange-500/30 bg-orange-600/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-orange-400">
            <Flame className="h-3.5 w-3.5" /> Promoção da Semana
          </div>
          <h2 className="text-2xl font-bold leading-tight tracking-tight text-white md:text-3xl">
            {settings.banner_title || settings.establishment_name}
          </h2>
          <p className="mt-1 text-sm text-neutral-300">
            {settings.banner_subtitle || 'Confira nosso cardápio e peça agora!'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="pl-1 text-sm font-semibold uppercase tracking-widest text-neutral-400">Categorias</h3>
        <div
          id="categories-carousel"
          className="scrollbar-none flex w-full max-w-full items-center gap-2 overflow-x-auto pb-2 pr-1 md:flex-wrap md:justify-center md:overflow-visible md:pr-0"
        >
          <button
            id="category-btn-all"
            onClick={() => setSelectedCategory('Todos')}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-all md:px-5 md:py-2.5 md:text-sm ${
              selectedCategory === 'Todos'
                ? 'border-orange-600 bg-orange-600 text-white shadow-md'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            id="category-btn-favorites"
            onClick={() => setSelectedCategory('__favorites__')}
            className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-all md:px-5 md:py-2.5 md:text-sm ${
              selectedCategory === '__favorites__'
                ? 'border-rose-500 bg-rose-500 text-white shadow-md'
                : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-white'
            }`}
          >
            Favoritos
          </button>
          {categories.map((cat, idx) => (
            <button
              id={`category-btn-${idx}`}
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-all md:px-5 md:py-2.5 md:text-sm ${
                selectedCategory === cat
                  ? 'border-orange-600 bg-orange-600 text-white shadow-md'
                  : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {favoriteProducts.length > 0 && selectedCategory !== '__favorites__' && !searchQuery.trim() && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">Seus favoritos</h3>
              <p className="mt-1 text-xs text-neutral-500">Acesso rápido aos itens que você marcou.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory('__favorites__')}
              className="text-xs font-semibold text-rose-300 transition hover:text-rose-200"
            >
              Ver todos
            </button>
          </div>
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {favoriteProducts.slice(0, 3).map((product) => renderProductCard(product, 'Favorito', 'favorites'))}
          </div>
        </section>
      )}

      {topPurchasedProducts.length > 0 && !searchQuery.trim() && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-sky-300" />
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-400">Peça de novo</h3>
              <p className="mt-1 text-xs text-neutral-500">Itens mais pedidos por você neste dispositivo.</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {topPurchasedProducts.slice(0, 3).map((product) => renderProductCard(product, 'Mais pedido', 'history'))}
          </div>
        </section>
      )}

      <div id="products-grid" className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/40 py-16 text-center">
            <p className="font-medium text-neutral-500">Nenhum produto encontrado nesta categoria.</p>
          </div>
        ) : (
          filteredProducts.map((product) => renderProductCard(product, undefined, 'catalog'))
        )}
      </div>

      {selectedProduct && (
        <div id="product-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
          <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="relative h-56 bg-neutral-950">
              <img
                src={optimizeImageUrl(selectedProduct.image_url)}
                alt={selectedProduct.name}
                loading="eager"
                decoding="async"
                width="400"
                height="300"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = fallbackImage;
                }}
              />
              <button
                id="close-product-modal-top"
                onClick={() => setSelectedProduct(null)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-800 bg-black/60 text-xl font-bold text-white transition hover:bg-black/90"
              >
                &times;
              </button>
            </div>

            <div className="max-h-[350px] flex-1 space-y-4 overflow-y-auto p-6">
              <div>
                <span className="rounded bg-orange-950/30 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-orange-500">
                  {selectedProduct.category}
                </span>
                <h3 className="mt-1.5 text-xl font-bold text-white">{selectedProduct.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{selectedProduct.description}</p>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 p-3.5">
                <span className="text-sm font-medium text-neutral-400">Preco Unitario</span>
                <div className="text-right">
                  {selectedProduct.is_promo && selectedProduct.promo_price ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-neutral-500 line-through">R$ {selectedProduct.price.toFixed(2).replace('.', ',')}</span>
                      <span className="text-base font-bold text-white">R$ {selectedProduct.promo_price.toFixed(2).replace('.', ',')}</span>
                    </div>
                  ) : (
                    <span className="text-base font-bold text-white">R$ {selectedProduct.price.toFixed(2).replace('.', ',')}</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="notes-textarea" className="block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Observacoes (opcional)
                </label>
                <textarea
                  id="notes-textarea"
                  placeholder="Ex: sem cebola, ponto da carne mal passado, sal sache, etc."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="h-20 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-white placeholder-neutral-600 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold uppercase text-neutral-400">Quantidade</span>
                <div className="flex items-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
                  <button
                    id="qty-minus"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="flex h-10 w-10 items-center justify-center border-r border-neutral-800 font-bold text-white transition hover:bg-neutral-800"
                  >
                    -
                  </button>
                  <span className="w-12 select-none text-center text-sm font-bold text-white">{quantity}</span>
                  <button
                    id="qty-plus"
                    onClick={() => setQuantity(Math.min(selectedProduct.stock_quantity || 99, quantity + 1))}
                    className="flex h-10 w-10 items-center justify-center border-l border-neutral-800 font-bold text-white transition hover:bg-neutral-800"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-neutral-850 bg-neutral-950 p-6">
              <button
                id="cancel-modal"
                onClick={() => setSelectedProduct(null)}
                className="flex-1 rounded-xl border border-neutral-800 bg-neutral-900 py-3 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800"
              >
                Voltar
              </button>

              <button
                id="confirm-add-to-cart"
                disabled={addToCartAction.status === 'loading'}
                onClick={() => {
                  handleConfirmAddToCart().catch(() => {});
                }}
                className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-bold text-white shadow-lg shadow-orange-950/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {addToCartAction.status === 'loading' ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>Adicionando...</span>
                  </>
                ) : addToCartAction.status === 'success' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                    <span>Adicionado</span>
                  </>
                ) : (
                  <span>Confirmar R$ {((selectedProduct.is_promo && selectedProduct.promo_price ? selectedProduct.promo_price : selectedProduct.price) * quantity).toFixed(2).replace('.', ',')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
