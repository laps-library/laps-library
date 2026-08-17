const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')
    const FUNCTION_BASE = `https://${ref}.functions.supabase.co`

    const { plan_id, user_id, redirect_url, one_time_amount, reservation_id } = await req.json()
    if (!plan_id || !user_id) {
      return new Response(JSON.stringify({ error: 'plan_id et user_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const { data: plan, error: planErr } = await supabase.from('plans').select('*').eq('id', plan_id).single()
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: 'Formule introuvable' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const amount = plan.price_cents ?? 0
    const interval = plan.price_period === 'year' ? 'year' : 'month'
    const hasOneTime = one_time_amount && one_time_amount > 0

    const params = new URLSearchParams()
    params.set('mode', amount > 0 ? 'subscription' : 'payment')
    params.set('client_reference_id', user_id)
    params.set('metadata[user_id]', user_id)
    params.set('metadata[plan_id]', plan_id)
    if (reservation_id) params.set('metadata[reservation_id]', reservation_id)
    if (hasOneTime) params.set('metadata[kind]', 'subscription_with_slot')
    
    // Produit 1 : abonnement (récurrent)
    params.set('line_items[0][quantity]', '1')
    params.set('line_items[0][price_data][currency]', 'eur')
    params.set('line_items[0][price_data][unit_amount]', String(amount))
    params.set('line_items[0][price_data][product_data][name]', plan.name)
    if (amount > 0) params.set('line_items[0][price_data][recurring][interval]', interval)
    
    // Produit 2 : créneau (ponctuel, si applicable)
    if (hasOneTime) {
      params.set('line_items[1][quantity]', '1')
      params.set('line_items[1][price_data][currency]', 'eur')
      params.set('line_items[1][price_data][unit_amount]', String(one_time_amount))
      params.set('line_items[1][price_data][product_data][name]', 'Créneau LAPS Library')
    }
    
    const redirectQS = redirect_url ? `&redirect=${encodeURIComponent(redirect_url)}` : ''
    params.set('success_url', `${FUNCTION_BASE}/payment-success?session_id={CHECKOUT_SESSION_ID}${redirectQS}`)
    params.set('cancel_url', `${FUNCTION_BASE}/payment-success?cancelled=true${redirectQS}`)

    const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const session = await stripeResp.json()
    if (!stripeResp.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || 'Erreur Stripe' }), {
        status: stripeResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
