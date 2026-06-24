import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { code, order_total, user_id } = await req.json() as {
      code: string;
      order_total: number;
      user_id: string;
    };

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1 — Fetch coupon
    const { data: coupon, error: cErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .single();

    if (cErr || !coupon) {
      return json({ error: 'Cupom inválido ou não encontrado.' }, 400);
    }

    // 2 — Active?
    if (!coupon.is_active) return json({ error: 'Este cupom não está mais ativo.' }, 400);

    // 3 — Validity window
    const now = Date.now();
    if (new Date(coupon.valid_from).getTime() > now) return json({ error: 'Este cupom ainda não está vigente.' }, 400);
    if (coupon.valid_until && new Date(coupon.valid_until).getTime() < now) return json({ error: 'Este cupom expirou.' }, 400);

    // 4 — Max uses
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return json({ error: 'Este cupom atingiu o limite de usos.' }, 400);
    }

    // 5 — Minimum order value
    if (order_total < coupon.min_order) {
      return json({ error: `Pedido mínimo de R$ ${coupon.min_order.toFixed(2)} para usar este cupom.` }, 400);
    }

    // 6 — Already used by this user?
    const { data: use } = await supabase
      .from('coupon_uses')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (use) return json({ error: 'Você já utilizou este cupom.' }, 400);

    // 7 — Calculate discount
    const discount =
      coupon.type === 'percent'
        ? Math.min((order_total * coupon.value) / 100, order_total)
        : Math.min(coupon.value, order_total);

    return json({
      coupon_id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discount: Math.round(discount * 100) / 100,
    });
  } catch (err) {
    return json({ error: 'Erro interno ao validar cupom.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
