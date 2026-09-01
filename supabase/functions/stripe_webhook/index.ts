const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  let timestamp = ''
  let v1 = ''
  for (const part of header.split(',')) {
    const [k, v] = part.split('=')
    if (k === 't') timestamp = v
    if (k === 'v1') v1 = v
  }
  if (!timestamp || !v1) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`))
  const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return computed === v1
}

Deno.serve(async (req) => {
  try {
    const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const rawBody = await req.text()
    const valid = await verifySignature(rawBody, req.headers.get('stripe-signature') || '', SECRET)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Signature invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const event = JSON.parse(rawBody)
    if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
      const obj = event.data.object
      const user_id = obj.client_reference_id || obj.metadata?.user_id
      const plan_id = obj.metadata?.plan_id
      const kind = obj.metadata?.kind
      const reservation_id = obj.metadata?.reservation_id
      const loan_id = obj.metadata?.loan_id
      const pack_id = obj.metadata?.pack_id
      const privatization_id = obj.metadata?.privatization_id

      const { createClient } = await import('npm:@supabase/supabase-js@2')
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const now = new Date().toISOString()

      if (plan_id) {
        const { data: plan } = await supabase.from('plans').select('price_period').eq('id', plan_id).single()
        const expires = new Date()
        if (plan?.price_period === 'year') expires.setFullYear(expires.getFullYear() + 1)
        else expires.setMonth(expires.getMonth() + 1)
        await supabase.from('profiles').update({ plan_id, subscription_expires_at: expires.toISOString() }).eq('id', user_id)
      } else if (kind === 'reservation' && reservation_id) {
        await supabase.from('reservations').update({ status: 'confirmed', payment_status: 'paid', paid_at: now }).eq('id', reservation_id)
        try { await fetch('https://jgibgmctgbwnphvjkkke.functions.supabase.co/booking_email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reservation_id }) }) } catch (e) {}
      } else if (kind === 'loan' && loan_id) {
        await supabase.from('loans').update({ status: 'active', payment_status: 'paid', paid_at: now }).eq('id', loan_id)
      } else if (kind === 'slot_pack' && pack_id) {
        await supabase.from('slot_packs').update({ payment_status: 'paid', paid_at: now }).eq('id', pack_id)
      } else if (kind === 'privatization' && privatization_id) {
        await supabase.from('privatizations').update({ status: 'confirmed', payment_status: 'paid', paid_at: now }).eq('id', privatization_id)
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
