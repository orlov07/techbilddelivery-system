/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Bike, MapPin, Check, ChevronRight, RefreshCw, MessageCircle } from 'lucide-react';
import { Order, Motoboy, AppSettings, AppUser } from '../types';

interface MotoboyPanelProps {
  currentUser: AppUser | null;
  orders: Order[];
  motoboys: Motoboy[];
  settings: AppSettings;
  onAssignMotoboy: (orderId: string, motoboyId: string | undefined) => Promise<void>;
  onUpdateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  onUpdateOrderPaymentStatus: (orderId: string, status: Order['payment_status']) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export default function MotoboyPanel({
  currentUser,
  orders,
  motoboys,
  settings,
  onAssignMotoboy,
  onUpdateOrderStatus,
  onUpdateOrderPaymentStatus,
  onRefreshData,
}: MotoboyPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const activeStatuses: Order['status'][] = ['aceito', 'preparando'];

  const getWhatsAppUrl = (order: Order) => {
    const phone = order.customer_phone.replace(/\D/g, '');
    if (!phone) return null;
    const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`;
    const message = encodeURIComponent(`Ola, ${order.customer_name}! Estou entrando em contato sobre o pedido ${order.seq_code ?? ''} do TechBild Delivery.`);
    return `https://wa.me/${normalizedPhone}?text=${message}`;
  };

  const activeDriver = motoboys.find(
    (motoboy) => currentUser?.email && motoboy.email.toLowerCase() === currentUser.email.toLowerCase()
  );

  const assignedOrders = orders.filter((order) => order.motoboy_id === activeDriver?.id && order.type === 'delivery');
  const availableOrders = orders.filter(
    (order) =>
      order.type === 'delivery' &&
      !order.motoboy_id &&
      activeStatuses.includes(order.status)
  );
  const pendingDeliveries = assignedOrders.filter((order) => !['entregue', 'cancelado', 'recusado'].includes(order.status));
  const finishedDeliveries = assignedOrders.filter((order) => order.status === 'entregue');
  const totalCommissionEarned = finishedDeliveries.length * (activeDriver?.commission_rate || 5);

  const handleClaimOrder = async (orderId: string) => {
    if (!activeDriver) return;
    setIsLoading(true);
    await onAssignMotoboy(orderId, activeDriver.id);
    setIsLoading(false);
  };

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    setIsLoading(true);
    await onUpdateOrderStatus(orderId, status);
    if (status === 'entregue') {
      await onUpdateOrderPaymentStatus(orderId, 'pago');
    }
    setIsLoading(false);
  };

  return (
    <div id="motoboy-panel-root" className="mx-auto mt-4 w-full max-w-4xl space-y-6 pb-12 text-xs text-white">
      <div className="space-y-3 rounded-2xl border border-neutral-850 bg-neutral-900 p-5">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500">Acesso - Perfil do Entregador</label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 rounded-xl border border-neutral-805 bg-neutral-950 p-3 text-sm font-semibold text-neutral-200">
            {activeDriver
              ? `${activeDriver.name} - Placa ${activeDriver.license_plate}`
              : currentUser
                ? `Nenhum motoboy ativo vinculado ao e-mail ${currentUser.email}.`
                : 'Faca login com uma conta real de motoboy para visualizar suas entregas.'}
          </div>

          <button
            onClick={async () => {
              setIsLoading(true);
              await onRefreshData();
              setIsLoading(false);
            }}
            className="group flex items-center justify-center gap-2 rounded-xl border border-neutral-805 bg-neutral-950 p-3 transition hover:bg-neutral-800"
          >
            <RefreshCw className="h-4 w-4 text-orange-500 transition duration-300 group-hover:rotate-180" />
            <span className="font-bold text-neutral-300">Atualizar</span>
          </button>
        </div>

        {activeDriver && (
          <div className="flex items-center gap-2 rounded-lg border border-orange-900/30 bg-orange-950/20 p-2.5 text-[10px] font-semibold text-orange-400">
            <span className="animate-pulse">●</span> Logado como {activeDriver.name}. Visualizando faturamento e comissoes da placa {activeDriver.license_plate}.
          </div>
        )}
      </div>

      {!currentUser ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-neutral-850 bg-neutral-900/30 py-16 text-center">
          <Bike className="mx-auto h-12 w-12 stroke-[1.2] text-neutral-700" />
          <p className="font-medium text-neutral-500">Faca login com uma conta real de motoboy para iniciar os trabalhos.</p>
        </div>
      ) : !activeDriver ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-neutral-850 bg-neutral-900/30 py-16 text-center">
          <Bike className="mx-auto h-12 w-12 stroke-[1.2] text-neutral-700" />
          <p className="font-medium text-neutral-500">Nao existe cadastro de motoboy ativo para o e-mail {currentUser.email}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <h3 className="block border-l-2 border-sky-500 pl-2 text-base font-bold uppercase tracking-wider text-white">
              Pedidos Disponiveis ({availableOrders.length})
            </h3>

            {availableOrders.length === 0 ? (
              <div className="space-y-2 rounded-xl border border-neutral-850 bg-neutral-900/40 py-10 text-center">
                <Bike className="mx-auto h-10 w-10 stroke-[1.4] text-neutral-700" />
                <p className="font-bold text-neutral-400">Nenhuma corrida livre agora.</p>
                <p className="text-[11px] text-neutral-500">Novos pedidos aceitos ou em preparo vao aparecer aqui para voce assumir.</p>
              </div>
            ) : (
              availableOrders.map((order) => (
                <div
                  key={`available-${order.id}`}
                  className="space-y-4 rounded-xl border border-sky-900/40 bg-sky-950/10 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-900/20 pb-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-sky-300">{order.seq_code}</span>
                      <span className="rounded px-2 py-0.5 text-[9px] font-bold uppercase text-sky-300 ring-1 ring-inset ring-sky-800/40">
                        {order.status}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/80">
                      Corrida sem entregador
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase text-neutral-500">Cliente</span>
                      <strong className="mt-0.5 block text-neutral-200">{order.customer_name}</strong>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase text-neutral-500">Endereco</span>
                      <p className="mt-0.5 text-neutral-300">{order.address || settings.address}</p>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase text-neutral-500">Total</span>
                      <strong className="mt-0.5 block text-neutral-200">R$ {order.total.toFixed(2).replace('.', ',')}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleClaimOrder(order.id)}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Bike className="h-4 w-4" />
                    <span>Assumir Entrega</span>
                  </button>
                </div>
              ))
            )}

            <h3 className="block border-l-2 border-orange-500 pl-2 text-base font-bold uppercase tracking-wider text-white">
              Sua Fila de Entregas ({pendingDeliveries.length})
            </h3>

            {isLoading && (
              <div className="flex justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            )}

            {!isLoading && pendingDeliveries.length === 0 ? (
              <div className="space-y-2 rounded-xl border border-neutral-850 bg-neutral-900/40 py-12 text-center">
                <Check className="mx-auto h-10 w-10 stroke-[1.5] text-emerald-400/70" />
                <p className="font-bold text-neutral-400">Tudo limpo por aqui!</p>
                <p className="text-[11px] text-neutral-500">Nenhum pedido de entrega atribuido a voce no momento.</p>
              </div>
            ) : (
              pendingDeliveries.map((order) => (
                <div
                  id={`motoboy-order-${order.id}`}
                  key={order.id}
                  className="flex flex-col justify-between space-y-4 rounded-xl border border-neutral-850 bg-neutral-950 p-5 transition hover:border-neutral-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-orange-400">{order.seq_code}</span>
                      <span className="text-xs text-neutral-500">Estimado {settings.avg_delivery_time}</span>
                    </div>

                    <span
                      className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                        order.status === 'enviando'
                          ? 'border border-orange-800/45 bg-orange-950/70 text-orange-400'
                          : 'bg-neutral-900 text-neutral-400'
                      }`}
                    >
                      {order.status === 'enviando' ? 'Em rota' : 'Pronto p/ sair'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-neutral-500" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold uppercase text-neutral-500">Endereco de Entrega</span>
                        <p className="mt-0.5 rounded-lg border border-neutral-850/30 bg-neutral-900/50 p-2.5 text-sm font-semibold leading-relaxed text-neutral-200">
                          {(order as any).address || settings.address}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-1 text-xs sm:grid-cols-3">
                      <div className="min-w-0">
                        <span className="block select-none text-[10px] uppercase text-neutral-500">Cliente</span>
                        <strong className="mt-0.5 block text-neutral-300">{order.customer_name}</strong>
                      </div>
                      <div className="min-w-0">
                        <span className="block select-none text-[10px] uppercase text-neutral-500">Contato</span>
                        <a href={`tel:${order.customer_phone}`} className="mt-0.5 block font-mono text-slate-200 outline-none hover:text-orange-400">
                          {order.customer_phone}
                        </a>
                        {getWhatsAppUrl(order) && (
                          <a
                            href={getWhatsAppUrl(order)!}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#25d366]/30 bg-[#25d366]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#25d366] transition hover:bg-[#25d366]/20"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="block select-none text-[10px] uppercase text-neutral-500">Faturamento total</span>
                        <strong className="mt-0.5 block text-neutral-200">R$ {order.total.toFixed(2).replace('.', ',')}</strong>
                        <span className="text-[10px] uppercase text-neutral-450">{order.payment_method.replace('_', ' ')}</span>
                      </div>
                    </div>

                    {order.change_for && (
                      <div className="flex flex-col gap-2 rounded-lg border border-red-900/10 bg-red-950/20 p-2.5 text-xs text-red-400 sm:flex-row sm:items-center sm:justify-between">
                        <span>Atencao: levar troco para <strong>R$ {order.change_for}</strong></span>
                        <strong className="font-mono text-sm leading-none">Troco: R$ {(parseFloat(order.change_for) - order.total).toFixed(2).replace('.', ',')}</strong>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-neutral-900 pt-2">
                    {order.status !== 'enviando' ? (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'enviando')}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-3 font-bold text-white transition hover:bg-orange-700"
                      >
                        <ChevronRight className="h-4 w-4" />
                        <span>Confirmar Saida para Entrega</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'entregue')}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4" />
                        <span>Marcar como Entregue e Pago</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-4">
            <h3 className="block border-l-2 border-orange-500 pl-2 text-base font-bold uppercase tracking-wider text-white">
              Historico & Ganhos
            </h3>

            <div className="space-y-4 rounded-2xl border border-neutral-850 bg-neutral-950 p-5">
              <div className="space-y-1 rounded-xl border border-neutral-850/50 bg-neutral-900 py-4 text-center">
                <span className="text-[10px] font-semibold uppercase text-neutral-500">Ganhos em Comissoes</span>
                <p className="font-mono text-2xl font-extrabold leading-none text-emerald-400">R$ {totalCommissionEarned.toFixed(2).replace('.', ',')}</p>
                <span className="block pt-1 text-[9px] uppercase text-neutral-400">comissao de R$ {activeDriver.commission_rate.toFixed(2).replace('.', ',')} por corrida</span>
              </div>

              <div className="flex items-center justify-between border-b border-neutral-900 pb-2 text-xs text-neutral-450">
                <span>Total Corridas Entregues:</span>
                <strong className="text-sm text-white">{finishedDeliveries.length} entregas</strong>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500">Relatorio das Ultimas Entregas</span>

                {finishedDeliveries.length === 0 ? (
                  <p className="py-6 text-center italic text-neutral-600">Nenhuma entrega realizada hoje.</p>
                ) : (
                  <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {finishedDeliveries.map((delivery) => (
                      <div key={delivery.id} className="flex items-center justify-between rounded-lg border border-neutral-850 bg-neutral-900 p-2.5">
                        <div>
                          <strong className="block font-mono text-neutral-300">{delivery.seq_code}</strong>
                          <span className="block text-[10px] text-neutral-500">{delivery.customer_name}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">+ R$ {activeDriver.commission_rate.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
