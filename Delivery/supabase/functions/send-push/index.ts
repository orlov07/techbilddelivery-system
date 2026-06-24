import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

interface PushSubscriptionRow {
  id: string;
  user_id: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_role: string | null;
  is_active: boolean;
}

interface PushPayload {
  recipientUserIds: string[];
  recipientRoles: string[];
  notification: {
    title: string;
    body: string;
    url: string;
    icon: string;
    badge: string;
    orderId: string;
    orderCode: string;
    status: string;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // 1. Validate bearer token
  const expectedToken = Deno.env.get('PUSH_FUNCTION_TOKEN');
  if (!expectedToken) {
    return json({ error: 'PUSH_FUNCTION_TOKEN_NOT_CONFIGURED' }, 500);
  }
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${expectedToken}`) {
    return json({ error: 'UNAUTHORIZED' }, 401);
  }

  // 2. Validate VAPID secrets
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return json({ error: 'VAPID_NOT_CONFIGURED' }, 500);
  }

  // 3. Parse and validate payload
  let payload: PushPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'INVALID_JSON_PAYLOAD' }, 400);
  }

  const { recipientUserIds, recipientRoles, notification } = payload;
  if (!notification?.title) {
    return json({ error: 'MISSING_NOTIFICATION_TITLE' }, 400);
  }

  // 4. Build Supabase admin client
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'SUPABASE_NOT_CONFIGURED' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // 5. Fetch active subscriptions, applying recipient filters
  let query = supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, user_role, is_active')
    .eq('is_active', true);

  const hasUserFilter = Array.isArray(recipientUserIds) && recipientUserIds.length > 0;
  const hasRoleFilter = Array.isArray(recipientRoles) && recipientRoles.length > 0;

  if (hasUserFilter && hasRoleFilter) {
    query = query.or(
      `user_id.in.(${recipientUserIds.join(',')}),user_role.in.(${recipientRoles.join(',')})`
    );
  } else if (hasUserFilter) {
    query = query.in('user_id', recipientUserIds);
  } else if (hasRoleFilter) {
    query = query.in('user_role', recipientRoles);
  }

  const { data: subscriptions, error: fetchError } = await query;
  if (fetchError) {
    return json({ error: 'FAILED_TO_FETCH_SUBSCRIPTIONS', detail: fetchError.message }, 500);
  }
  if (!subscriptions || subscriptions.length === 0) {
    return json({ sent: 0, failed: 0, disabled: 0, message: 'NO_ACTIVE_SUBSCRIPTIONS' });
  }

  // 6. Configure VAPID details
  (webpush as typeof webpush).setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const notificationPayload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: notification.icon || '/Delivery-192.png',
    badge: notification.badge || '/Delivery-192.png',
    tag: `order-${notification.orderId}`,
    url: notification.url || '/',
    data: {
      orderId: notification.orderId,
      orderCode: notification.orderCode,
      status: notification.status,
      url: notification.url || '/',
    },
  });

  // 7. Send to each subscription, collect stale endpoints to disable
  const toDisable: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      try {
        await (webpush as typeof webpush).sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload,
          { TTL: 86400 }
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 404 = endpoint no longer exists, 410 = subscription explicitly expired
        if (statusCode === 404 || statusCode === 410) {
          toDisable.push(sub.id);
        }
      }
    })
  );

  // 8. Deactivate stale subscriptions so we stop trying them
  if (toDisable.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('id', toDisable);
  }

  return json({ sent, failed, disabled: toDisable.length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
