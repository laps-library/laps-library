const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')
    const FUNCTION_BASE = `https://${ref}.functions.supabase.co`

    const { user_id, amount_cents, label, kind, reservation_id, loan_id, pack_id, privatization_id, redirect_url } = await req.json()
    if (!user_id || amount_cents == null || !kind) {
      return new Response(JSON.stringify({ error: 'user_id, amount_cents, kind requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const params = new URLSearchParams()
    params.set('mode', amount_cents > 0 ? 'payment' : 'setup')
    params.set('client_reference_id', user_id)
    params.set('metadata[user_id]', user_id)
    params.set('metadata[kind]', kind)
    if (reservation_id) params.set('metadata[reservation_id]', reservation_id)
    if (loan_id) params.set('metadata[loan_id]', loan_id)
    if (pack_id) params.set('metadata[pack_id]', pack_id)
    if (privatization_id) params.set('metadata[privatization_id]', privatization_id)
    if (amount_cents > 0) {
      params.set('line_items[0][quantity]', '1')
      params.set('line_items[0][price_data][currency]', 'eur')
      params.set('line_items[0][price_data][unit_amount]', String(amount_cents))
      params.set('line_items[0][price_data][product_data][name]', label || 'LAPS Library')
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
