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
    const url = new URL(req.url)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const debug = url.searchParams.get('debug') === '1'
    const { user_id } = body
    if (!user_id && !debug) return new Response(JSON.stringify({ error: 'user_id requis' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions?limit=50', {
      headers: { 'Authorization': `Bearer ${STRIPE_KEY}` },
    })
    const stripe = await stripeResp.json()
    if (!stripeResp.ok) return new Response(JSON.stringify({ error: stripe.error?.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (debug) {
      const rows = (stripe.data ?? []).map((s: any) => ({
        id: s.id.slice(0, 10),
        payment_status: s.payment_status,
        client_reference_id: s.client_reference_id,
        metadata: s.metadata,
        amount: s.amount_total,
        created: new Date(s.created * 1000).toISOString().slice(0, 19),
      }))
      return new Response(JSON.stringify({ sessions: rows }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const now = new Date().toISOString()
    let fixed = 0
    const details: string[] = []

    // Récupère les sessions déjà traitées
    const { data: processed } = await supabase.from('processed_sessions').select('session_id')
    const processedIds = new Set((processed ?? []).map((p: any) => p.session_id))

    for (const s of (stripe.data ?? [])) {
      if (s.payment_status !== 'paid' || s.client_reference_id !== user_id) continue
      if (processedIds.has(s.id)) continue

      const m = s.metadata ?? {}
      
      if (m.kind === 'reservation' && m.reservation_id) {
        const { data } = await supabase.from('reservations').update({ status: 'confirmed', payment_status: 'paid', paid_at: now }).eq('id', m.reservation_id).select()
        details.push('resa:' + (data ?? []).length)
        fixed += (data ?? []).length
        for (const row of (data ?? [])) { try { await fetch('https://jgibgmctgbwnphvjkkke.functions.supabase.co/booking_email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservation_id: row.id }) }) } catch (e) {} }
      } else if (m.kind === 'loan' && m.loan_id) {
        const { data } = await supabase.from('loans').update({ payment_status: 'paid', paid_at: now }).eq('id', m.loan_id).select()
        details.push('loan:' + (data ?? []).length)
        fixed += (data ?? []).length
      } else if (m.kind === 'slot_pack' && m.pack_id) {
        const { data } = await supabase.from('slot_packs').update({ payment_status: 'paid', paid_at: now }).eq('id', m.pack_id).select()
        details.push('pack:' + (data ?? []).length)
        fixed += (data ?? []).length
      } else if (m.kind === 'privatization' && m.privatization_id) {
        const { data } = await supabase.from('privatizations').update({ status: 'confirmed', payment_status: 'paid', paid_at: now }).eq('id', m.privatization_id).select()
        details.push('privat:' + (data ?? []).length)
        fixed += (data ?? []).length
      } else if (m.kind === 'subscription_with_slot' && m.plan_id && m.reservation_id) {
        // Abonnement + créneau
        const { data: plan } = await supabase.from('plans').select('price_period, name').eq('id', m.plan_id).single()
        const expires = new Date()
        if (plan?.price_period === 'year') expires.setFullYear(expires.getFullYear() + 1)
        else expires.setMonth(expires.getMonth() + 1)
        await supabase.from('profiles').update({ plan_id: m.plan_id, subscription_expires_at: expires.toISOString() }).eq('id', user_id)
        details.push('plan:' + (plan?.name ?? m.plan_id))
        fixed += 1
        
        const { data: resa } = await supabase.from('reservations').update({ status: 'confirmed', payment_status: 'paid', paid_at: now }).eq('id', m.reservation_id).select()
        details.push('resa:' + (resa ?? []).length)
        fixed += (resa ?? []).length
        for (const row of (resa ?? [])) { try { await fetch('https://jgibgmctgbwnphvjkkke.functions.supabase.co/booking_email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservation_id: row.id }) }) } catch (e) {} }
      } else if (m.plan_id) {
        const { data: plan } = await supabase.from('plans').select('price_period, name').eq('id', m.plan_id).single()
        const expires = new Date()
        if (plan?.price_period === 'year') expires.setFullYear(expires.getFullYear() + 1)
        else expires.setMonth(expires.getMonth() + 1)
        await supabase.from('profiles').update({ plan_id: m.plan_id, subscription_expires_at: expires.toISOString() }).eq('id', user_id)
        details.push('plan:' + (plan?.name ?? m.plan_id))
        fixed += 1
      }

      await supabase.from('processed_sessions').insert({ session_id: s.id })
      processedIds.add(s.id)
    }

    return new Response(JSON.stringify({ ok: true, fixed, details, user_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
