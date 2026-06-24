import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_APP_URL = 'https://techbilddelivery.web.app';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) {
      return json(
        { error: 'Configure o secret MERCADO_PAGO_ACCESS_TOKEN no Supabase para ativar o cartao de credito.' },
        400,
      );
    }

    const body = await req.json() as {
      orderId: string;
      total: number;
      customerName: string;
      customerEmail?: string;
      items?: Array<{ title: string; quantity: number; unit_price: number }>;
    };

    if (!body.orderId || !body.total || body.total <= 0) {
      return json({ error: 'Pedido invalido para gerar checkout.' }, 400);
    }

    const origin = req.headers.get('origin') || DEFAULT_APP_URL;
    const returnUrl = normalizeUrl(origin);
    const items = (body.items || [])
      .filter((item) => item && item.quantity > 0 && item.unit_price > 0)
      .map((item) => ({
        title: item.title?.trim() || 'Pedido TechBild Delivery',
        quantity: item.quantity,
        currency_id: 'BRL',
        unit_price: roundMoney(item.unit_price),
      }));

    const preferencePayload = {
      external_reference: body.orderId,
      items: items.length > 0
        ? items
        : [
            {
              title: `Pedido ${body.orderId}`,
              quantity: 1,
              currency_id: 'BRL',
              unit_price: roundMoney(body.total),
            },
          ],
      payer: {
        name: body.customerName?.trim() || 'Cliente TechBild',
        email: body.customerEmail?.trim() || undefined,
      },
      back_urls: {
        success: returnUrl,
        failure: returnUrl,
        pending: returnUrl,
      },
      auto_return: 'approved',
      statement_descriptor: 'TECHBILD',
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok || !mpData?.init_point) {
      const message = mpData?.message || mpData?.error || 'Nao foi possivel criar o checkout no Mercado Pago.';
      return json({ error: message }, 400);
    }

    return json({
      checkoutUrl: mpData.init_point as string,
      preferenceId: mpData.id as string,
    });
  } catch (error) {
    return json({ error: 'Erro interno ao iniciar o checkout de cartao.' }, 500);
  }
});

function normalizeUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
