const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json().catch(() => ({}))
    const reservation_id = body.reservation_id
    if (!reservation_id) return new Response(JSON.stringify({ error: 'reservation_id requis' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const RESEND = Deno.env.get('RESEND_API_KEY')!
    const FROM = Deno.env.get('EMAIL_FROM') ?? 'reservations@grandangle.org'
    const { createClient } = await import('npm:@supabase/supabase-js@2')
    const supabase = createClient(SUPABASE_URL, SERVICE)

    const { data: r } = await supabase.from('reservations').select('*').eq('id', reservation_id).single()
    if (!r) return new Response(JSON.stringify({ error: 'réservation introuvable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: prof } = await supabase.from('profiles').select('email, first_name').eq('id', r.user_id).single()
    if (!prof?.email) return new Response(JSON.stringify({ error: 'email introuvable' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    let poste = ''
    if (r.station_id) {
      const { data: st } = await supabase.from('instrument_models').select('name').eq('id', r.station_id).single()
      poste = st?.name ?? ''
    }
    if (!poste && r.workstation_id) {
      const { data: ws } = await supabase.from('workstations').select('name').eq('id', r.workstation_id).single()
      poste = ws?.name ?? ''
    }

    const date = (r.reservation_date ?? '').slice(0, 10)
    const amountEur = ((r as any).price_cents ?? 9500) / 100

    const html = `<div style="font-family:sans-serif;background:#000;color:#fff;padding:24px">
      <h2 style="color:#ff2bd6;font-style:italic">_LAPS Library</h2>
      <p>Bonjour ${prof.first_name ?? ''},</p>
      <p>✅ <b>Ta demande de créneau supervisé a été validée par LAPS !</b></p>
      <ul>
        <li><b>Date :</b> ${date}</li>
        <li><b>Horaire :</b> ${r.start_time ?? ''} – ${r.end_time ?? ''}</li>
        <li><b>Poste :</b> ${poste || 'Libre service'}</li>
        <li><b>Montant :</b> ${amountEur} €</li>
      </ul>
      <p>Pour confirmer définitivement ta réservation, ouvre l'application LAPS Library et clique sur le bouton rose <b>« Payer ton créneau supervisé »</b> qui t'attend sur ta page d'accueil.</p>
      <p style="color:#8e8e93">Après paiement, tu recevras un email de confirmation avec le fichier .ics à ajouter à ton calendrier.</p>
    </div>`

    const toEmail = body.force_to ?? prof.email

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LAPS Library <' + FROM + '>',
        to: [toEmail],
        subject: '_LAPS Library · Crèneau supervisé validé — viens payer !',
        html,
      }),
    })
    const out = await res.json()
    return new Response(JSON.stringify({ ok: res.ok, out, to: toEmail }), { status: res.ok ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
