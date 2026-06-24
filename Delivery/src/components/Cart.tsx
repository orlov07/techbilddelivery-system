/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ShoppingBasket,
  Truck,
  Home,
  Store,
  MapPin,
  CreditCard,
  DollarSign,
  QrCode,
  Trash2,
  ArrowLeft,
  Send,
  LoaderCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { Product, AppSettings, AppUser, Order, CouponValidationResult } from '../types';
import ActionDialog from './ActionDialog';
import CheckoutStepper from './CheckoutStepper';
import { useAsyncAction } from '../hooks/useAsyncAction';
import type { CartItem } from '../contexts/CartContext';
import { useCEP } from '../hooks/useCEP';
import { recordCompletedOrder } from '../utils/customerInsights';
import { getSavedAddresses, saveAddress } from '../utils/savedAddresses';

interface CartProps {
  cart: CartItem[];
  settings: AppSettings;
  user: AppUser | null;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  onClose: () => void;
  onSubmitOrder: (orderPayload: any) => Promise<Order | null>;
  onCreateCreditCardCheckout?: (payload: {
    orderId: string;
    total: number;
    customerName: string;
    customerEmail?: string;
    items: Array<{ title: string; quantity: number; unit_price: number }>;
  }) => Promise<{ checkoutUrl: string }>;
  onValidateCoupon?: (code: string, total: number, userId: string) => Promise<CouponValidationResult>;
  cashbackBalance?: number;
  onRecordCouponUse?: (couponId: string, orderId: string) => Promise<void>;
  onDebitCashback?: (orderId: string, amount: number) => Promise<void>;
}

const fallbackImage = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=50&w=200';

const optimizeImageUrl = (url?: string, width = 400) => {
  if (!url || !url.startsWith('http')) return fallbackImage;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}w=${width}&q=80`;
};

export default function Cart({
  cart,
  settings,
  user,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  onClose,
  onSubmitOrder,
  onCreateCreditCardCheckout,
  onValidateCoupon,
  cashbackBalance = 0,
  onRecordCouponUse,
  onDebitCashback,
}: CartProps) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [customerName, setCustomerName] = useState(user?.nome || '');
  const [customerPhone, setCustomerPhone] = useState(user?.telefone || '');
  const [orderType, setOrderType] = useState<'delivery' | 'retirada' | 'mesa'>('delivery');
  const [tableNumber, setTableNumber] = useState('');
  const [address, setAddress] = useState(user?.endereco || '');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pagamento_entrega' | 'pagamento_mesa'>('pix');
  const [notes, setNotes] = useState('');
  const [changeFor, setChangeFor] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pixDialogOpen, setPixDialogOpen] = useState(false);
  const [pixPaymentOpen, setPixPaymentOpen] = useState(false);
  const [creditCheckoutUrl, setCreditCheckoutUrl] = useState('');
  const [creditPaymentMessage, setCreditPaymentMessage] = useState('');
  const [removeDialog, setRemoveDialog] = useState<{ open: boolean; productId: string; productName: string }>({
    open: false,
    productId: '',
    productName: '',
  });
  const submitOrderAction = useAsyncAction();

  const [couponCode,       setCouponCode]       = useState('');
  const [couponResult,     setCouponResult]      = useState<CouponValidationResult | null>(null);
  const [couponError,      setCouponError]       = useState('');
  const [couponLoading,    setCouponLoading]     = useState(false);
  const [useCashback,      setUseCashback]       = useState(false);
  const [savedAddresses,   setSavedAddresses]    = useState<string[]>(() => getSavedAddresses());

  const { cep: addressCep, setCep: setAddressCep, lookupCEP, formatAddress, isLoading: cepLoading } = useCEP();
  const addressRef = useRef(address);

  useEffect(() => {
    document.title =
      step === 'success'
        ? 'Pedido Confirmado - TechBild Delivery'
        : step === 'checkout'
          ? 'Finalizar Pedido - TechBild Delivery'
          : 'Seu Carrinho - TechBild Delivery';
  }, [step]);

  const handleOrderTypeChange = (type: 'delivery' | 'retirada' | 'mesa') => {
    setOrderType(type);
    setPaymentMethod(type === 'mesa' ? 'pagamento_mesa' : 'pix');
  };

  const subtotal = cart.reduce((acc, item) => {
    const activePrice = item.product.is_promo && item.product.promo_price ? item.product.promo_price : item.product.price;
    return acc + activePrice * item.quantity;
  }, 0);

  const deliveryFee    = orderType === 'delivery' ? settings.delivery_fee : 0;
  const couponDiscount = couponResult?.discount ?? 0;
  const cashbackUsed   = useCashback ? Math.min(cashbackBalance, subtotal + deliveryFee - couponDiscount) : 0;
  const total          = Math.max(0, subtotal + deliveryFee - couponDiscount - cashbackUsed);
  const currentStep: 1 | 2 | 3 = step === 'success' ? 3 : step === 'checkout' ? 2 : 1;
  const cartItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const pixPayload = (settings.pix_code || settings.pix_key || '').trim();
  const pixQrCodeUrl = pixPayload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixPayload)}`
    : '';

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (!settings.is_open) {
      setErrorMessage(`O estabelecimento esta fechado no momento (${settings.business_hours}). Aguarde a reabertura para concluir o pedido.`);
      return;
    }
    setStep('checkout');
  };

  const validateField = (field: string, value: string) => {
    let message = '';

    if (field === 'customerName' && !value.trim()) {
      message = 'Informe seu nome.';
    }

    if (field === 'customerPhone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 10) {
        message = 'Informe um telefone valido com DDD.';
      }
    }

    if (field === 'address' && orderType === 'delivery' && !value.trim()) {
      message = 'Informe o endereco completo para entrega.';
    }

    if (field === 'tableNumber' && orderType === 'mesa' && !value.trim()) {
      message = 'Informe o numero da mesa.';
    }

    if (field === 'changeFor' && paymentMethod === 'dinheiro' && value) {
      const parsed = parseFloat(value.replace(',', '.'));
      if (Number.isNaN(parsed) || parsed < total) {
        message = 'O troco precisa ser maior que o total.';
      }
    }

    setFieldErrors((prev) => ({
      ...prev,
      [field]: message,
    }));

    return !message;
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !user || !onValidateCoupon) return;
    setCouponError('');
    setCouponResult(null);
    setCouponLoading(true);
    try {
      const result = await onValidateCoupon(couponCode, subtotal + deliveryFee, user.id);
      setCouponResult(result);
    } catch (err) {
      setCouponError(err instanceof Error ? err.message : 'Cupom inválido.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handlePlaceOrder = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setCreditPaymentMessage('');

    if (!settings.is_open) {
      setErrorMessage(`O estabelecimento esta fechado no momento (${settings.business_hours}). Novos pedidos estao bloqueados agora.`);
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Por favor, digite seu nome.');
      validateField('customerName', customerName);
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Por favor, informe um telefone de contato.');
      validateField('customerPhone', customerPhone);
      return;
    }
    if (orderType === 'delivery' && !address.trim()) {
      setErrorMessage('Por favor, preencha o endereco de entrega completo.');
      validateField('address', address);
      return;
    }
    if (orderType === 'mesa' && !tableNumber.trim()) {
      setErrorMessage('Por favor, informe o numero da mesa.');
      validateField('tableNumber', tableNumber);
      return;
    }
    if (paymentMethod === 'dinheiro' && changeFor) {
      const changeVal = parseFloat(changeFor.replace(',', '.'));
      if (Number.isNaN(changeVal) || changeVal < total) {
        setErrorMessage(`O valor do troco deve ser maior que o total do pedido (R$ ${total.toFixed(2).replace('.', ',')}).`);
        validateField('changeFor', changeFor);
        return;
      }
    }

    let pendingCheckoutWindow: Window | null = null;

    try {
      await submitOrderAction.execute(async () => {
        if (paymentMethod === 'cartao_credito') {
          pendingCheckoutWindow = window.open('', '_blank', 'noopener,noreferrer');
        }

        const orderPayload = {
          user_id: user?.id || null,
          customer_name: customerName,
          customer_phone: customerPhone,
          type: orderType,
          table_number: orderType === 'mesa' ? tableNumber : undefined,
          payment_method: paymentMethod,
          subtotal,
          delivery_fee: deliveryFee,
          coupon_id: couponResult?.coupon_id || null,
          coupon_discount: couponDiscount || null,
          cashback_used: cashbackUsed || null,
          total,
          notes,
          change_for: paymentMethod === 'dinheiro' && changeFor ? changeFor : undefined,
          address: orderType === 'delivery' ? address : undefined,
        };

        const itemsPayload = cart.map((item) => ({
          id: item.product.id,
          name: item.product.name,
          price: item.product.is_promo && item.product.promo_price ? item.product.promo_price : item.product.price,
          cost: item.product.cost_price ?? 0,
          quantity: item.quantity,
        }));

        const response = await onSubmitOrder({ order: orderPayload, items: itemsPayload });
        if (!response) {
          throw new Error('Sua sessao expirou ou ocorreu um erro de conexao. Tente novamente.');
        }

        // Record coupon use and cashback debit (fire-and-forget; non-blocking)
        if (couponResult && user && onRecordCouponUse) {
          onRecordCouponUse(couponResult.coupon_id, response.id).catch(console.error);
        }
        if (cashbackUsed > 0 && user && onDebitCashback) {
          onDebitCashback(response.id, cashbackUsed).catch(console.error);
        }

        let nextCreditCheckoutUrl = '';
        let nextCreditPaymentMessage = '';
        if (paymentMethod === 'cartao_credito') {
          if (!onCreateCreditCardCheckout) {
            nextCreditPaymentMessage = 'O checkout de cartao ainda nao esta disponivel nesta loja.';
            if (pendingCheckoutWindow && !pendingCheckoutWindow.closed) pendingCheckoutWindow.close();
          } else {
            try {
              const checkout = await onCreateCreditCardCheckout({
                orderId: response.id,
                total,
                customerName,
                customerEmail: user?.email,
                items: itemsPayload.map((item) => ({
                  title: item.name,
                  quantity: item.quantity,
                  unit_price: item.price,
                })),
              });
              nextCreditCheckoutUrl = checkout.checkoutUrl;
              if (pendingCheckoutWindow && !pendingCheckoutWindow.closed) {
                pendingCheckoutWindow.location.href = checkout.checkoutUrl;
              }
            } catch (checkoutError) {
              if (pendingCheckoutWindow && !pendingCheckoutWindow.closed) pendingCheckoutWindow.close();
              nextCreditPaymentMessage = checkoutError instanceof Error
                ? checkoutError.message
                : 'Nao foi possivel abrir o checkout de cartao.';
            }
          }
        }

        recordCompletedOrder(cart);
        if (orderType === 'delivery' && address.trim()) {
          setSavedAddresses(saveAddress(address));
        }
        setCreditCheckoutUrl(nextCreditCheckoutUrl);
        setCreditPaymentMessage(nextCreditPaymentMessage);
        setCreatedOrder(response);
        setStep('success');
        clearCart();
      });
    } catch (err) {
      if (pendingCheckoutWindow && !pendingCheckoutWindow.closed) pendingCheckoutWindow.close();
      setErrorMessage(err instanceof Error ? err.message : 'Ocorreu um erro ao enviar o pedido.');
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(settings.pix_code || settings.pix_key);
    setPixDialogOpen(true);
  };

  const handleOpenPixPayment = () => {
    if (!pixPayload) {
      setErrorMessage('Cadastre a chave Pix do estabelecimento antes de usar esse pagamento.');
      return;
    }

    setPixPaymentOpen(true);
  };

  const paymentOptions = orderType === 'mesa'
    ? [
        {
          id: 'pix' as const,
          label: 'Pix',
          subtitle: 'Aprovacao imediata',
          icon: QrCode,
        },
        {
          id: 'pagamento_mesa' as const,
          label: 'Pagamento na mesa',
          subtitle: 'Maquininha ou Pix presencial',
          icon: CreditCard,
        },
      ]
    : [
        {
          id: 'pix' as const,
          label: 'Pix',
          subtitle: 'Aprovacao imediata',
          icon: QrCode,
        },
        {
          id: 'cartao_credito' as const,
          label: 'Cartao de credito',
          subtitle: 'Checkout online com cartao',
          icon: CreditCard,
        },
        {
          id: 'cartao_debito' as const,
          label: 'Cartao de debito',
          subtitle: 'Pagamento na entrega',
          icon: CreditCard,
        },
        {
          id: 'dinheiro' as const,
          label: 'Dinheiro',
          subtitle: 'Levar troco se necessario',
          icon: DollarSign,
        },
        {
          id: 'pagamento_entrega' as const,
          label: 'Pagamento na entrega',
          subtitle: 'Definir na chegada do entregador',
          icon: Truck,
        },
      ];

  return (
    <div id="cart-absolute-overlay" className="fixed inset-0 z-50 flex max-w-full overflow-x-hidden bg-black/80 backdrop-blur-sm">
      <div className="flex-1" onClick={onClose} />

      <div id="cart-drawer-container" className="relative flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-neutral-850 bg-neutral-950 text-white shadow-2xl">
        <ActionDialog
          open={pixDialogOpen}
          title="Pix copiado"
          message="O codigo Pix Copia e Cola foi copiado com sucesso."
          confirmLabel="OK"
          showCancel={false}
          tone="success"
          onCancel={() => setPixDialogOpen(false)}
          onConfirm={() => setPixDialogOpen(false)}
        />
        {pixPaymentOpen && (
          <div className="absolute inset-0 z-[72] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-500">Pagamento Pix</p>
                  <h4 className="mt-1 text-lg font-bold text-white">Cobrar R$ {total.toFixed(2).replace('.', ',')}</h4>
                  <p className="mt-1 text-xs text-neutral-400">Use o QR Code ou copie a chave do estabelecimento.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPixPaymentOpen(false)}
                  className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-800"
                >
                  Fechar
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {settings.pix_code ? (
                  <div className="rounded-2xl border border-neutral-800 bg-white p-4">
                    <img
                      src={pixQrCodeUrl}
                      alt="QR Code Pix"
                      width="240"
                      height="240"
                      className="mx-auto h-56 w-56 object-contain"
                    />
                  </div>
                ) : null}

                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
                    {settings.pix_code ? 'Pix copia e cola / chave' : 'Chave Pix'}
                  </p>
                  <p className="mt-2 break-all font-mono text-sm text-orange-300">{pixPayload}</p>
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white transition hover:bg-orange-700"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar Pix
                  </button>
                </div>

                <div className="rounded-2xl border border-emerald-900/30 bg-emerald-950/20 p-3 text-[11px] leading-relaxed text-emerald-300">
                  Depois de pagar, finalize o pedido normalmente. O restaurante recebera a referencia do pagamento Pix.
                </div>
              </div>
            </div>
          </div>
        )}
        <ActionDialog
          open={removeDialog.open}
          title="Remover item"
          message={`Deseja remover "${removeDialog.productName}" do carrinho?`}
          confirmLabel="Remover"
          cancelLabel="Voltar"
          tone="danger"
          onCancel={() => setRemoveDialog({ open: false, productId: '', productName: '' })}
          onConfirm={() => {
            removeFromCart(removeDialog.productId);
            setRemoveDialog({ open: false, productId: '', productName: '' });
          }}
        />

        {step === 'cart' && (
          <>
            <div className="shrink-0 border-b border-neutral-850 bg-neutral-900/40 p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ShoppingBasket className="h-6 w-6 text-orange-500" />
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold">Seu Carrinho</h3>
                    {cart.length > 0 && (
                      <p className="text-xs text-neutral-400">
                        {cartItemsCount} {cartItemsCount === 1 ? 'item no pedido' : 'itens no pedido'}
                      </p>
                    )}
                  </div>
                </div>
                <button id="close-cart-btn" onClick={onClose} className="shrink-0 text-sm font-semibold text-neutral-400 transition hover:text-white sm:text-lg">
                  Fechar
                </button>
              </div>
              <CheckoutStepper currentStep={currentStep} />
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-4 py-20 text-center">
                  <ShoppingBasket className="h-16 w-16 stroke-[1.5] text-neutral-700" />
                  <p className="font-medium text-neutral-400">Seu carrinho está vazio.</p>
                  <button id="back-to-shop-btn" onClick={onClose} className="rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-950/20 transition hover:bg-orange-700">
                    Navegar pelo Cardápio
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => {
                    const activePrice = item.product.is_promo && item.product.promo_price ? item.product.promo_price : item.product.price;
                    return (
                      <div
                        id={`cart-item-${item.product.id}`}
                        key={item.product.id}
                        className="rounded-2xl border border-neutral-850 bg-neutral-900/40 p-4 transition hover:border-neutral-800"
                      >
                        <div className="flex gap-4">
                          <img
                            src={optimizeImageUrl(item.product.image_url, 240)}
                            alt={item.product.name}
                            loading="lazy"
                            decoding="async"
                            width="96"
                            height="96"
                            className="h-[72px] w-[72px] shrink-0 rounded-xl border border-neutral-800 bg-neutral-950 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = fallbackImage;
                            }}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="pr-2 text-sm font-bold text-neutral-100">{item.product.name}</h4>
                                {item.notes && <p className="mt-1 text-[11px] italic text-orange-300/85">Observação: {item.notes}</p>}
                              </div>
                              <button
                                id={`remove-cart-${item.product.id}`}
                                onClick={() => setRemoveDialog({ open: true, productId: item.product.id, productName: item.product.name })}
                                className="shrink-0 rounded-lg border border-neutral-800 bg-neutral-950 p-2 text-neutral-500 transition hover:border-red-500/40 hover:text-red-400"
                                aria-label={`Remover ${item.product.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                              <div className="space-y-2">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Quantidade</p>
                                <div className="flex items-center overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
                                  <button
                                    id={`decrease-qty-${item.product.id}`}
                                    onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                                    className="px-3 py-2 text-sm font-bold text-white transition hover:bg-neutral-850"
                                  >
                                    −
                                  </button>
                                  <span className="min-w-10 px-2 text-center text-sm font-bold text-neutral-100">{item.quantity}</span>
                                  <button
                                    id={`increase-qty-${item.product.id}`}
                                    onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                                    className="px-3 py-2 text-sm font-bold text-white transition hover:bg-neutral-850"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Valor da linha</p>
                                <p className="mt-1 text-lg font-bold text-orange-400">R$ {(activePrice * item.quantity).toFixed(2).replace('.', ',')}</p>
                                <p className="text-[11px] text-neutral-500">R$ {activePrice.toFixed(2).replace('.', ',')} por unidade</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="shrink-0 space-y-4 border-t border-neutral-800 bg-neutral-900 p-4 pb-[calc(16px+env(safe-area-inset-bottom))] sm:p-6 sm:pb-[calc(24px+env(safe-area-inset-bottom))]">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
                  <div className="flex items-center justify-between text-sm text-neutral-400">
                    <span>Subtotal</span>
                    <span className="font-semibold text-white">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-neutral-400">
                    <span>Taxa de entrega</span>
                    <span className="font-semibold text-white">R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-3">
                    <span className="text-base font-bold text-neutral-100">Total</span>
                    <span className="text-2xl font-bold text-orange-400">R$ {(subtotal + deliveryFee).toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>

                <button
                  id="go-to-checkout-btn"
                  onClick={handleCheckout}
                  disabled={!settings.is_open}
                  className="w-full rounded-xl bg-orange-600 py-4 text-sm font-bold text-white shadow-lg shadow-orange-950/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-orange-600"
                >
                  {settings.is_open ? 'Continuar para pagamento' : 'Estabelecimento fechado'}
                </button>
              </div>
            )}
          </>
        )}

        {step === 'checkout' && (
          <form onSubmit={handlePlaceOrder} className="flex h-full flex-col">
            <div className="space-y-4 border-b border-neutral-850 bg-neutral-900/40 p-6">
              <div className="flex items-center gap-3">
                <button
                  id="back-to-cart-btn"
                  type="button"
                  onClick={() => setStep('cart')}
                  className="rounded-lg border border-neutral-800 bg-neutral-950 p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h3 className="text-lg font-bold">Quase la! Finalizar Pedido</h3>
                  <p className="text-xs text-neutral-400">Insira as informacoes de envio e pagamento</p>
                </div>
              </div>
              <CheckoutStepper currentStep={currentStep} />
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {errorMessage && <div className="rounded-xl border border-red-800 bg-red-950/50 p-3.5 text-xs font-semibold text-red-200">{errorMessage}</div>}

              {!settings.is_open && (
                <div className="rounded-xl border border-yellow-800 bg-yellow-950/50 p-3.5 text-xs leading-relaxed text-yellow-200">
                  <strong>Atencao:</strong> O estabelecimento e exibido como fechado no momento ({settings.business_hours}). O recebimento de pedidos reais pode estar desativado na cozinha.
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-450">Opcao de entrega</label>
                <div className="grid grid-cols-1 gap-2 rounded-xl border border-neutral-800 bg-neutral-950 p-1.5 sm:grid-cols-3">
                  <button
                    id="type-delivery-btn"
                    type="button"
                    onClick={() => handleOrderTypeChange('delivery')}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg p-2.5 text-xs font-semibold transition ${
                      orderType === 'delivery' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Truck className="h-4 w-4" />
                    <span>Entrega</span>
                  </button>
                  <button
                    id="type-retirada-btn"
                    type="button"
                    onClick={() => handleOrderTypeChange('retirada')}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg p-2.5 text-xs font-semibold transition ${
                      orderType === 'retirada' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Store className="h-4 w-4" />
                    <span>Retirada</span>
                  </button>
                  <button
                    id="type-mesa-btn"
                    type="button"
                    onClick={() => handleOrderTypeChange('mesa')}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg p-2.5 text-xs font-semibold transition ${
                      orderType === 'mesa' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Home className="h-4 w-4" />
                    <span>Comanda/Mesa</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-neutral-850 bg-neutral-900/30 p-4">
                <h4 className="border-b border-neutral-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-white">Sua Identificacao</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="customer-name-input" className="block text-[10px] font-medium uppercase text-neutral-450">Nome</label>
                    <input
                      id="customer-name-input"
                      type="text"
                      placeholder="Ex: Maria Silva"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      onBlur={(e) => validateField('customerName', e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                      required
                    />
                    {fieldErrors.customerName && <p className="text-[11px] text-red-300">{fieldErrors.customerName}</p>}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="customer-phone-input" className="block text-[10px] font-medium uppercase text-neutral-450">Telefone/Zap</label>
                    <input
                      id="customer-phone-input"
                      type="tel"
                      inputMode="numeric"
                      placeholder="Ex: (11) 99999-5555"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onBlur={(e) => validateField('customerPhone', e.target.value)}
                      className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                      required
                    />
                    {fieldErrors.customerPhone && <p className="text-[11px] text-red-300">{fieldErrors.customerPhone}</p>}
                  </div>
                </div>
              </div>

              {orderType === 'delivery' && (
                <div className="space-y-3 rounded-xl border border-neutral-850 bg-neutral-900/30 p-4">
                  <div className="flex items-center gap-2 border-b border-neutral-800 pb-1.5 text-orange-400">
                    <MapPin className="h-4 w-4" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">Endereco de Entrega</h4>
                  </div>
                  {/* CEP lookup */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-medium text-neutral-440">CEP (auto-preenchimento)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={addressCep}
                        onChange={async (e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                          const fmt = digits.length > 5 ? `${digits.slice(0,5)}-${digits.slice(5)}` : digits;
                          setAddressCep(fmt);
                          if (digits.length === 8) {
                            const data = await lookupCEP(digits);
                            if (data) setAddress(formatAddress(data));
                          }
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        className="w-36 rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                      />
                      {cepLoading && <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />}
                      {!cepLoading && addressCep.replace(/\D/g,'').length === 8 && (
                        <span className="text-[10px] text-emerald-400">✓ Endereço preenchido</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="address-textarea" className="block text-[10px] font-medium text-neutral-440">Endereço completo (rua, número, complemento)</label>
                    <textarea
                      id="address-textarea"
                      placeholder="Av. Paulista, 1000 - Apto 404 - Bela Vista - Sao Paulo / SP"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      onBlur={(e) => validateField('address', e.target.value)}
                      className="h-16 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-xs text-white focus:border-orange-500 focus:outline-none"
                      required
                    />
                    {fieldErrors.address && <p className="text-[11px] text-red-300">{fieldErrors.address}</p>}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-440">Enderecos salvos</span>
                      <button
                        type="button"
                        onClick={() => setSavedAddresses(saveAddress(address))}
                        className="text-[10px] font-semibold text-orange-400 transition hover:text-orange-300"
                      >
                        Salvar atual
                      </button>
                    </div>
                    {savedAddresses.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {savedAddresses.map((savedAddress, index) => (
                          <button
                            key={`${savedAddress}-${index}`}
                            type="button"
                            onClick={() => setAddress(savedAddress)}
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-medium transition ${
                              address === savedAddress
                                ? 'border-orange-500 bg-orange-950/40 text-orange-300'
                                : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700'
                            }`}
                          >
                            {savedAddress.length > 36 ? `${savedAddress.slice(0, 36)}...` : savedAddress}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-neutral-500">Salve um endereco frequente para preencher mais rapido no proximo pedido.</p>
                    )}
                  </div>
                </div>
              )}

              {orderType === 'mesa' && (
                <div className="space-y-3 rounded-xl border border-neutral-850 bg-neutral-900/30 p-4">
                  <h4 className="border-b border-neutral-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-white">Informacoes da Mesa</h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="table-number-input" className="block text-[10px] font-bold uppercase text-neutral-440">Numero da Mesa</label>
                      <input
                        id="table-number-input"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="99"
                        placeholder="Ex: 08"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        onBlur={(e) => validateField('tableNumber', e.target.value)}
                        className="w-full rounded-lg border border-neutral-850 bg-neutral-950 p-2.5 text-xs font-bold text-white focus:border-orange-500 focus:outline-none"
                        required
                      />
                      {fieldErrors.tableNumber && <p className="text-[11px] text-red-300">{fieldErrors.tableNumber}</p>}
                    </div>
                    <div className="flex items-end pb-1 text-[11px] font-medium leading-snug text-orange-400 select-none">
                      Sem taxa de entrega! O pedido sera levado diretamente ate sua comanda.
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-xl border border-neutral-850 bg-neutral-900/30 p-4">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-neutral-500">Resumo do pedido</p>
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-neutral-400">
                      <span>Subtotal</span>
                      <span className="font-semibold text-white">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-400">
                      <span>Taxa de entrega</span>
                      <span className="font-semibold text-white">R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-neutral-800 pt-2 text-sm font-bold text-white">
                      <span>Total</span>
                      <span className="text-orange-400">R$ {total.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white">Forma de pagamento</h4>
                  <button type="button" className="text-[11px] font-semibold text-orange-400 transition hover:text-orange-300">
                    Ver taxas
                  </button>
                </div>

                <div className="space-y-2">
                  {paymentOptions.map((option) => {
                    const Icon = option.icon;
                    const isActive = paymentMethod === option.id;

                    return (
                      <button
                        key={option.id}
                        id={`payment-option-${option.id}`}
                        type="button"
                        onClick={() => setPaymentMethod(option.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                          isActive
                            ? 'border-orange-500 bg-orange-950/30'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                          isActive ? 'border-orange-400 bg-orange-500/15' : 'border-neutral-600'
                        }`}>
                          <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-orange-400' : 'bg-transparent'}`} />
                        </span>
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          isActive ? 'bg-orange-500/15 text-orange-300' : 'bg-neutral-900 text-neutral-400'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm font-semibold ${isActive ? 'text-white' : 'text-neutral-200'}`}>{option.label}</span>
                          <span className={`block text-[11px] ${isActive ? 'text-orange-200/80' : 'text-neutral-500'}`}>{option.subtitle}</span>
                        </span>
                        {option.id === 'pix' && (
                          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-300">
                            Aprovacao imediata
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === 'pix' && (
                  <div className="rounded-2xl border border-orange-900/30 bg-neutral-950 p-4 animate-fade-in">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">Pix do estabelecimento</p>
                        <p className="mt-1 text-[11px] text-neutral-500">Clique em OK para gerar a cobranca Pix.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenPixPayment}
                        className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-orange-700"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}

                {paymentMethod === 'dinheiro' && (
                  <div className="animate-fade-in space-y-1.5 pt-2">
                    <label htmlFor="change-for-input" className="block text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                      Precisa de troco para quanto?
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-500">R$</span>
                      <input
                        id="change-for-input"
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex: 50,00 ou 100,00"
                        value={changeFor}
                        onChange={(e) => setChangeFor(e.target.value)}
                        onBlur={(e) => validateField('changeFor', e.target.value)}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 pl-9 text-xs font-bold text-white focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    {fieldErrors.changeFor && <p className="text-[11px] text-red-300">{fieldErrors.changeFor}</p>}
                  </div>
                )}

                {paymentMethod === 'cartao_credito' && (
                  <div className="rounded-2xl border border-sky-900/30 bg-neutral-950 p-4 animate-fade-in">
                    <p className="text-sm font-bold text-white">Checkout online no credito</p>
                    <p className="mt-1 text-[11px] text-neutral-400">
                      Ao confirmar, o pedido sera criado e voce sera levado para a tela segura de pagamento do cartao.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="order-notes-textarea" className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Mensagem ou observacao do pedido
                </label>
                <textarea
                  id="order-notes-textarea"
                  placeholder="Ex: campainha quebrada, ligar ao chegar, deixar com porteiro, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-16 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-neutral-800 bg-neutral-900 p-6">

              {/* ── Cupom ── */}
              {user && onValidateCoupon && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Cupom de desconto</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); setCouponError(''); }}
                      placeholder="CÓDIGO DO CUPOM"
                      className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-mono text-white outline-none placeholder:text-neutral-600 focus:border-orange-700"
                    />
                    <button
                      type="button"
                      disabled={couponLoading || !couponCode.trim() || !!couponResult}
                      onClick={handleApplyCoupon}
                      className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {couponLoading ? '...' : couponResult ? '✓' : 'Aplicar'}
                    </button>
                  </div>
                  {couponError && <p className="text-[10px] text-red-400">{couponError}</p>}
                  {couponResult && (
                    <p className="text-[10px] text-emerald-400">
                      Cupom <strong>{couponResult.code}</strong> aplicado — desconto de R$ {couponResult.discount.toFixed(2).replace('.', ',')}
                    </p>
                  )}
                </div>
              )}

              {/* ── Cashback ── */}
              {user && cashbackBalance > 0 && (
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 hover:border-neutral-700">
                  <div>
                    <p className="text-xs font-semibold text-white">Usar cashback</p>
                    <p className="text-[10px] text-neutral-400">Saldo disponível: <strong className="text-orange-400">R$ {cashbackBalance.toFixed(2).replace('.', ',')}</strong></p>
                  </div>
                  <input
                    type="checkbox"
                    checked={useCashback}
                    onChange={(e) => setUseCashback(e.target.checked)}
                    className="h-4 w-4 accent-orange-500"
                  />
                </label>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Subtotal</span>
                  <span className="font-medium text-white">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                {orderType === 'delivery' && (
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Taxa de Entrega</span>
                    <span className="font-medium text-white">R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                {couponDiscount > 0 && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>Desconto ({couponResult?.code})</span>
                    <span className="font-medium">- R$ {couponDiscount.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                {cashbackUsed > 0 && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>Cashback aplicado</span>
                    <span className="font-medium">- R$ {cashbackUsed.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-neutral-800 pt-2 text-base font-bold text-white">
                  <span>Total Geral</span>
                  <span className="text-xl text-orange-400">R$ {total.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              <button
                id="place-order-submit-btn"
                type="submit"
                disabled={submitOrderAction.status === 'loading' || !settings.is_open}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-4 text-sm font-bold text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitOrderAction.status === 'loading' ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>Enviando pedido ao restaurante...</span>
                  </>
                ) : submitOrderAction.status === 'success' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                    <span>Pedido enviado</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>{settings.is_open ? `${paymentMethod === 'cartao_credito' ? 'Confirmar e pagar' : 'Confirmar Pedido'} - R$ ${total.toFixed(2).replace('.', ',')}` : 'Estabelecimento fechado'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {step === 'success' && createdOrder && (
          <div className="flex h-full flex-col space-y-6 overflow-y-auto bg-neutral-950 p-6 text-center text-neutral-100">
            <div className="flex flex-col items-center space-y-3 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500 bg-emerald-950 text-2xl font-bold text-emerald-400 shadow-lg shadow-emerald-950/30 animate-bounce">
                ✓
              </div>
              <h3 className="text-2xl font-extrabold tracking-tight text-white">Pedido Recebido!</h3>
              <p className="mx-auto max-w-sm text-xs text-neutral-400">
                Seu pedido foi registrado no sistema com sucesso e ja esta disponivel na cozinha de <strong>{settings.establishment_name}</strong>.
              </p>
            </div>

            <CheckoutStepper currentStep={currentStep} />

            <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-left">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3 text-center">
                <div>
                  <span className="text-[10px] font-bold uppercase text-neutral-500">CODIGO DO PEDIDO</span>
                  <p className="font-mono text-lg font-bold leading-none text-orange-400">{createdOrder.seq_code}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-neutral-500">HORARIO</span>
                  <p className="mt-0.5 text-xs font-semibold text-neutral-200">
                    {new Date(createdOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-b border-neutral-800 pb-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-450">Cliente:</span>
                  <span className="font-bold text-neutral-100">{createdOrder.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-450">Opcao:</span>
                  <span className="rounded border border-orange-500/20 bg-orange-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-400">
                    {createdOrder.type === 'delivery' ? 'Entrega' : createdOrder.type === 'retirada' ? 'Retirada' : `Mesa ${createdOrder.table_number}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-450">Pagamento:</span>
                  <span className="text-[10px] font-semibold uppercase text-neutral-200">{createdOrder.payment_method.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-450">Status Pagamento:</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${createdOrder.payment_status === 'pago' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                    {createdOrder.payment_status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1.5 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Subtotal</span>
                  <span>R$ {createdOrder.subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                {createdOrder.type === 'delivery' && (
                  <div className="flex justify-between text-neutral-400">
                    <span>Taxa de Entrega</span>
                    <span>R$ {createdOrder.delivery_fee.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-neutral-800 pt-2 text-base font-bold text-white">
                  <span>Valor Pago/Total</span>
                  <span className="text-orange-400">R$ {createdOrder.total.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

              {createdOrder.payment_method === 'pix' && createdOrder.payment_status === 'aguardando_pagamento' && (
                <div className="rounded-xl border border-neutral-850 bg-neutral-950 p-3 text-[10.5px] leading-relaxed text-yellow-300">
                  <strong>Pagamento Pendente por Pix:</strong>
                  <br />
                  Envie o valor de <strong>R$ {createdOrder.total.toFixed(2).replace('.', ',')}</strong> para a chave Pix:
                  <span className="mt-1 block font-bold text-white underline select-all">{settings.pix_key}</span>
                </div>
              )}

              {createdOrder.payment_method === 'cartao_credito' && (
                <div className="space-y-3 rounded-xl border border-sky-900/40 bg-sky-950/20 p-3 text-[10.5px] leading-relaxed text-sky-200">
                  <div>
                    <strong>Pagamento por cartao de credito:</strong>
                    <br />
                    Seu pedido ficou aguardando a aprovacao do pagamento.
                  </div>
                  {creditPaymentMessage && (
                    <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-2 text-amber-200">
                      {creditPaymentMessage}
                    </div>
                  )}
                  {creditCheckoutUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(creditCheckoutUrl, '_blank', 'noopener,noreferrer')}
                      className="w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
                    >
                      Pagar agora no cartao
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <a
                href={`https://wa.me/${settings.whatsapp}?text=Ol%C3%A1%21%20Acabei%20do%20fazer%20o%20pedido%20*${createdOrder.seq_code}*%20no%20valor%20de%20R%24%20${createdOrder.total.toFixed(2).replace('.', ',')}%0D%0APor%20favor%2C%20aguardo%20a%20confirmacao%20do%20restaurante.%20Obrigado%21`}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <span>Enviar Pedido ao WhatsApp</span>
              </a>

              <button
                id="close-success-btn"
                onClick={() => {
                  setStep('cart');
                  onClose();
                }}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-3.5 text-sm font-bold text-neutral-400 transition hover:bg-neutral-850 hover:text-white"
              >
                Fazer Outra Compra
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
