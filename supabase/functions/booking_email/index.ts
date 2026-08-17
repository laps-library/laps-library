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
    const d = date.replace(/-/g, '')
    const t = (x: string) => (x ?? '').slice(0, 5).replace(':', '') + '00'
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LAPS Library//FR', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + r.id + '@lapslibrary',
      'DTSTAMP:' + stamp,
      'DTSTART:' + d + 'T' + t(r.start_time),
      'DTEND:' + d + 'T' + t(r.end_time),
      'SUMMARY:Reservation LAPS Library - ' + (poste || 'Libre service'),
      'LOCATION:LAPS Library Studio',
      'DESCRIPTION:Creneau ' + (r.start_time ?? '') + '-' + (r.end_time ?? '') + ' / Poste: ' + (poste || 'libre service'),
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n')

    const html = `<div style="font-family:sans-serif;background:#000;color:#fff;padding:24px">
      <h2 style="color:#ff2bd6;font-style:italic">_LAPS Library</h2>
      <p>Bonjour ${prof.first_name ?? ''},</p>
      <p>Ta réservation est enregistrée :</p>
      <ul>
        <li><b>Date :</b> ${date}</li>
        <li><b>Horaire :</b> ${r.start_time ?? ''} – ${r.end_time ?? ''}</li>
        <li><b>Poste :</b> ${poste || 'Libre service'}</li>
      </ul>
      <p>📅 Un fichier <b>.ics</b> est joint : ouvre-le pour ajouter le créneau à ton calendrier.</p>
      <p style="color:#8e8e93">Annulation ou report possible jusqu'à 16 h avant le début du créneau.</p>
    </div>`

    const toEmail = body.force_to ?? prof.email

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'LAPS Library <' + FROM + '>',
        to: [toEmail],
        subject: '_LAPS Library · Réservation du ' + date,
        html,
        attachments: [{ filename: 'reservation-laps.ics', content: btoa(ics) }],
      }),
    })
    const out = await res.json()
    return new Response(JSON.stringify({ ok: res.ok, out, to: toEmail }), { status: res.ok ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
