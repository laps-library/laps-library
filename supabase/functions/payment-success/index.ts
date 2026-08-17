Deno.serve(async (req) => {
  const url = new URL(req.url)
  const cancelled = url.searchParams.get('cancelled') === 'true'
  const sessionId = url.searchParams.get('session_id')
  const redirect = url.searchParams.get('redirect')

  if (redirect) {
    const target = new URL(redirect)
    if (sessionId) target.searchParams.set('session_id', sessionId)
    if (cancelled) target.searchParams.set('cancelled', 'true')
    return new Response(null, { status: 302, headers: { Location: target.toString() } })
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>LAPS Library</title></head><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><h1>${cancelled ? 'Paiement annule' : 'Paiement recu'}</h1><p style="color:#8e8e93">${cancelled ? 'Retourne dans l\'application.' : 'C\'est bon ! Retourne dans l\'application.'}</p></div></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
})
