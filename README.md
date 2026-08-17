# LAPS

Application mobile de réservation pour le studio de musique LAPS.

## Architecture

| Couche | Technologie | Emplacement |
|---|---|---|
| App mobile | Expo / React Native (expo-router) | `apps/mobile/` |
| Backend | Supabase (auth, DB, storage) | projet cloud Supabase |
| Edge Functions | Deno (Stripe, emails) | `supabase/functions/` |
| Site web | prévu v1.5 | export web Expo |

## Structure du projet

- `apps/mobile/app/` : écrans (routage par fichiers)
  - `home.tsx` : accueil + mode balles (Play)
  - `reserve.tsx` : parcours de réservation
  - `catalog.tsx` : LIBRE SERVICE → PREMIUM → EMPRUNTABLE
  - `profile.tsx` : profil + réglages musique
  - `admin*.tsx` : administration
- `apps/mobile/components/`
  - `BounceOverlay.tsx` : moteur des balles (physique, déformation)
  - `ballAudio.ts` : synthèse WAV (gammes, morphing sine/square)
  - `MiniPlayer.tsx` : relapse_radio (10 pistes)
  - `YoutubePlayer*` : natif (mobile) / iframe (web)
- `apps/mobile/lib/supabase.ts` : client Supabase
- `apps/mobile/assets/` : GIF, audio, 123 photos d'instruments
- `supabase/functions/` : create_payment, stripe_webhook, emails…
- `supabase/migrations/` : schéma SQL

## Installation

```bash
cd apps/mobile
npm install
# créer .env avec :
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
npx expo start




cat >> README.md << 'EOF'

## Installation

    cd apps/mobile
    npm install
    # créer .env avec :
    #   EXPO_PUBLIC_SUPABASE_URL=...
    #   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
    npx expo start

## Commandes

| Action | Commande |
|---|---|
| Développement | npx expo start |
| Mode production (test) | npx expo start --no-dev --minify |
| Export web | npx expo export --platform web |
| Vérification types | npx tsc --noEmit |
| Régénérer le manifest photos | node scripts/generate-photo-manifest.js |

## Fonctionnalités clés

- Auth : inscription, confirmation email, rôles (client/admin)
- Plans : NEWBIE (gratuit) / PRO / NERD — gestion et résiliation
- Réservations : créneaux classiques et supervisés
  (validation admin → email → paiement Stripe → confirmation + .ics)
- Catalogue : 123 instruments, fiches avec photos zoomables et vidéo YouTube
- Mode balles : balles sonores activables via Play, limitées à la home,
  musique basée sur la fondamentale et la gamme du profil
- relapse_radio : lecteur musical global (MiniPlayer)

## Mode balles — détails techniques

- Sons WAV générés à la volée : sinusoïde morphée vers carré selon la hauteur,
  filtre passe-bas 600 Hz, release 0,45 s
- Cache des WAV dans Expo/cacheDirectory/ballnotes_v5/
- Physique : rebonds sur bords et boutons, collisions entre balles,
  déformation (squash) à l'impact
- Limites : 6 balles max, 6 s de vie, boucle au repos quand 0 balle

## Builds de production

Mobile (EAS) — nécessite un compte Expo + comptes stores :

    npm install -g eas-cli
    eas login
    eas build --platform ios      # ou android / all

Les identifiants actuels (com.laps.app) sont temporaires, à ajuster à la
création des comptes développeur.

Web — export statique fonctionnel (validé), voir notes v1.5.

## Notes v1.5 — conversion en site web

1. Paiement Stripe : remplacer openAuthSessionAsync (natif) par une
   redirection navigateur classique
2. Mode d'export : passer web output static en single (SPA)
3. Sons des balles : migrer de expo-av vers l'API Web Audio
4. Déploiement : héberger le dossier dist/ (Netlify, Vercel, etc.)

## Sécurité

- Les secrets (.env) ne sont pas commités
- Les Edge Functions utilisent la clé service (jamais exposée côté client)
- Vérifier les règles RLS Supabase avant mise en production
