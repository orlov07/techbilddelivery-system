import { supabase, isSupabaseConfigured } from '../supabaseClient';

const VAPID_PUBLIC_KEY = (import.meta as Record<string, unknown> & { env: Record<string, string> }).env
  .VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function subscribeToPushNotifications(
  userRole: 'cliente' | 'admin' | 'motoboy'
): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[WebPush] VITE_VAPID_PUBLIC_KEY não configurada.');
    return false;
  }
  if (!isSupabaseConfigured || !supabase) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;

    const pushSub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const p256dhBuffer = pushSub.getKey('p256dh');
    const authBuffer = pushSub.getKey('auth');
    if (!p256dhBuffer || !authBuffer) return false;

    const { error } = await supabase.rpc('upsert_push_subscription_secure', {
      p_endpoint:   pushSub.endpoint,
      p_p256dh:     bufferToBase64Url(p256dhBuffer),
      p_auth:       bufferToBase64Url(authBuffer),
      p_user_role:  userRole,
      p_user_agent: navigator.userAgent.slice(0, 250),
    });

    if (error) {
      console.error('[WebPush] Erro ao salvar subscription:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[WebPush] Falha ao assinar push:', err);
    return false;
  }
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const pushSub = await registration.pushManager.getSubscription();
    if (!pushSub) return;

    const endpoint = pushSub.endpoint;
    await pushSub.unsubscribe();

    if (isSupabaseConfigured && supabase) {
      await supabase.rpc('disable_push_subscription_secure', { p_endpoint: endpoint });
    }
  } catch (err) {
    console.error('[WebPush] Falha ao cancelar push:', err);
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}

export async function getOrderNotifications(
  limit = 20,
  offset = 0
): Promise<import('../types').OrderNotification[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('list_order_notifications_secure', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    console.error('[WebPush] Erro ao carregar notificações:', error.message);
    return [];
  }
  return (data ?? []) as import('../types').OrderNotification[];
}

export async function markNotificationsRead(notificationIds: string[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase || notificationIds.length === 0) return;
  const { error } = await supabase.rpc('mark_order_notifications_read_secure', {
    p_notification_ids: notificationIds,
  });
  if (error) {
    console.error('[WebPush] Erro ao marcar notificações como lidas:', error.message);
  }
}
