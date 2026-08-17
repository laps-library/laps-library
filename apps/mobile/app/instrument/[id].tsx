import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import YoutubePlayer from '../../components/YoutubePlayer';
import { LOCAL_FULL_PHOTOS } from '../../assets/instruments/manifest-full';
import AppButton from '../../components/AppButton';
import BackButton from '../../components/BackButton';
import { supabase } from '../../lib/supabase';
import ZoomableImage from '../../components/ZoomableImage';

function cleanKey(s: string) {
  return (s || '')
    .toString()
    .trim()
    .replace(/[\/\\:*?"<>|']/g, '')
    .replace(/\s+/g, '-');
}

function ytId(v: string) {
  const m = (v || '').match(
    /(?:watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/
  );

  return m ? m[1] : v || '';
}

const PHOTO_ALIASES: Record<string, string> = {
  'OBX8 Module': 'Oberheim/OBX-8-DESKTOP',
};

function photoSource(i: any) {
  const k = cleanKey(i.brand) + '/' + cleanKey(i.name);

  if ((LOCAL_FULL_PHOTOS as any)[k]) {
    return (LOCAL_FULL_PHOTOS as any)[k];
  }

  const found = Object.keys(LOCAL_FULL_PHOTOS).find(
    key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === k.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  if (found) {
    return (LOCAL_FULL_PHOTOS as any)[found];
  }

  // Repli : postes premium sans photo propre -> on cherche via le contenu du package
  for (const item of i.package ?? []) {
    const alias = PHOTO_ALIASES[item];
    if (alias && (LOCAL_FULL_PHOTOS as any)[alias]) return (LOCAL_FULL_PHOTOS as any)[alias];

    const ck = cleanKey(item).toLowerCase();
    const foundPkg = Object.keys(LOCAL_FULL_PHOTOS).find(
      (key) => (key.split('/')[1] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') === ck.replace(/[^a-z0-9]/g, '')
    );
    if (foundPkg) return (LOCAL_FULL_PHOTOS as any)[foundPkg];
  }

  return null;
}

const H = Dimensions.get('window').height;
const W = Dimensions.get('window').width;

export default function InstrumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [activeLoans, setActiveLoans] = useState(0);
  const [msg, setMsg] = useState('');
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('instrument_models')
        .select('*')
        .eq('id', id)
        .single();

      setItem(data);

      const { data: sess } = await supabase.auth.getSession();

      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sess.session?.user.id)
        .single();

      setProfile(p);

      if (p?.plan_id) {
        const { data: pl } = await supabase
          .from('plans')
          .select('*')
          .eq('id', p.plan_id)
          .single();

        setPlan(pl);
      }

      const { count } = await supabase
        .from('loans')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', sess.session?.user.id)
        .neq('status', 'returned');

      setActiveLoans(count ?? 0);
    }

    load();
  }, [id]);

  async function requestLoan() {
    if (profile?.id_document_status !== 'verified') {
      setMsg("Pièce d'identité vérifiée requise pour emprunter.");
      return;
    }

    if (!plan?.can_borrow) {
      setMsg("Ta formule ne permet pas d'emprunter d'instrument.");
      return;
    }

    if (plan.max_loans != null && activeLoans >= plan.max_loans) {
      setMsg(
        `Maximum ${plan.max_loans} emprunt(s) en cours avec ta formule (${activeLoans} actuel).`
      );
      return;
    }

    const { error } = await supabase
      .from('loans')
      .insert({
        user_id: profile.id,
        instrument_model_id: id,
      });

    if (error) {
      setMsg('Erreur : ' + error.message);
    } else {
      setMsg("Demande d'emprunt envoyée.");
      setActiveLoans(n => n + 1);
    }
  }

  if (!item) return null;

  const fullPhoto = photoSource(item);
  const photoDims = fullPhoto ? Image.resolveAssetSource(fullPhoto) : null;
  const photoH = photoDims ? Math.min(H * 0.7, W * (photoDims.height / photoDims.width)) : H * 0.6;
  const photoW = photoDims ? Math.min(W, photoH * (photoDims.width / photoDims.height)) : W;

  const canRequest =
    item.borrowable &&
    item.acquired &&
    plan?.can_borrow &&
    (plan.max_loans == null || activeLoans < plan.max_loans);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />

      <View style={styles.stickyHeader}>
        <Text style={styles.brandTitle}>{item.brand}</Text>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{(item.name || '').replace('Poste Premium — ', '')}</Text>
          <Text style={styles.yearInline}>{item.year ?? '—'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {fullPhoto ? (
          <View style={styles.photoWrap}>
            <TouchableOpacity
              onPress={() => setZoom(true)}
              activeOpacity={0.9}
            >
              <Image
                source={fullPhoto}
                style={{ width: photoW, height: photoH }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.photoEmpty, { height: photoH }]}>
            <Text style={styles.photoLetter}>
              {item.brand?.[0] ?? '_'}
            </Text>
          </View>
        )}

        <ZoomableImage source={fullPhoto} visible={zoom} onClose={() => setZoom(false)} />

        <Text style={styles.meta}>
          {item.category}
          {item.synthesis_type
            ? ` · ${item.synthesis_type}`
            : ''}
        </Text>

        <Text style={styles.meta}>
          Facilité {item.ease_of_use ?? '-'}/5
        </Text>

        {item.description ? (
          <Text style={styles.desc}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.badges}>
          <Text style={styles.badge}>
            {item.acquired ? 'Acquis' : 'À venir'}
          </Text>

          <Text style={styles.badge}>
            {item.borrowable ? 'Empruntable' : 'Sur place'}
          </Text>

          {item.units > 1 ? (
            <Text style={styles.badge}>
              ×{item.units} unités
            </Text>
          ) : null}
        </View>

        {item.package &&
          item.package.length > 0 && (
            <Text style={styles.label}>
              _Inclus dans le poste
            </Text>
          )}

        {(item.package ?? []).map(
          (pkg: string, idx: number) => (
            <Text
              key={idx}
              style={styles.packageItem}
            >
              _ {pkg}
            </Text>
          )
        )}

        {item.manual_url && (
          <AppButton
            label="Manuel d'utilisation"
            onPress={() =>
              Linking.openURL(item.manual_url)
            }
          />
        )}

        {item.videos &&
          item.videos.length > 0 && (
            <Text style={styles.label}>
              _Vidéos
            </Text>
          )}

        {(item.videos ?? []).map(
          (v: any, idx: number) => (
            <View
              key={idx}
              style={styles.videoWrap}
            >
              <Text style={styles.videoTitle}>
                {v.channel === 'loopop'
                  ? '_Loopop'
                  : v.channel === 'sonicstate'
                  ? '_Sonic State'
                  : '_Vidéo'}

                {v.title
                  ? ` · ${v.title}`
                  : ''}
              </Text>

              <YoutubePlayer
                height={220}
                videoId={ytId(v.id)}
                play={false}
              />
            </View>
          )
        )}

        {!item.borrowable && (
          <Text style={styles.note}>
            Instrument à utiliser sur place.
          </Text>
        )}

        {item.borrowable &&
          !item.acquired && (
            <Text style={styles.note}>
              Disponible à l'emprunt dès son arrivée.
            </Text>
          )}

        {item.borrowable &&
          item.acquired &&
          !plan && (
            <Text style={styles.note}>
              Chargement de ta formule...
            </Text>
          )}

        {item.borrowable &&
          item.acquired &&
          plan &&
          !plan.can_borrow && (
            <Text style={styles.note}>
              Ta formule ne permet pas l'emprunt
              d'instrument.
            </Text>
          )}

        {item.borrowable &&
          item.acquired &&
          plan?.can_borrow && (
            <Text style={styles.meta}>
              Emprunt jusqu'à{' '}
              {plan.loan_duration_days} jours · max{' '}
              {plan.max_loans} ({activeLoans}/
              {plan.max_loans} en cours)
            </Text>
          )}

        {canRequest && (
          <AppButton
            label="Demander l'emprunt"
            onPress={requestLoan}
          />
        )}

        {item.borrowable &&
          item.acquired &&
          plan?.can_borrow &&
          !canRequest && (
            <Text style={styles.note}>
              Limite d'emprunts atteinte avec ta formule.
            </Text>
          )}

        {msg ? (
          <Text style={styles.msg}>
            {msg}
          </Text>
        ) : null}
      </ScrollView>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  scroll: {
    padding: 24,
    gap: 10,
  },

  photoWrap: {
    marginHorizontal: -24,
    alignItems: 'center',
  },

  photo: {
    width: '100%',
    height: H,
    marginHorizontal: -24,
    backgroundColor: '#000',
  },

  photoEmpty: {
    width: '100%',
    height: H,
    marginHorizontal: -24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoLetter: {
    color: '#fff',
    fontSize: 90,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },

  brandTitle: {
    color: '#ff2bd6',
    fontWeight: 'bold',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 15,
  },

  name: {
    fontSize: 26,
    fontWeight: 'bold',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    color: '#fff',
    letterSpacing: 1,
  },

  meta: {
    color: '#fff',
    fontSize: 15,
  },

  stickyHeader: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },

  yearInline: {
    color: '#ff2bd6',
    fontSize: 15,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },

  badges: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },

  badge: {
    color: '#000',
    backgroundColor: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },

  note: {
    color: '#8e8e93',
    fontStyle: 'italic',
  },

  msg: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
  },

  label: {
    color: '#fff',
    marginTop: 8,
    fontWeight: 'bold',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  videoWrap: {
    gap: 6,
    marginTop: 4,
  },

  videoTitle: {
    color: '#ff2bd6',
    fontSize: 13,
    fontWeight: 'bold',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  video: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#000',
    overflow: 'hidden',
  },

  desc: {
    color: '#8e8e93',
    fontSize: 14,
    lineHeight: 20,
  },

  packageItem: {
    color: '#fff',
    fontSize: 14,
    fontStyle: 'italic',
  },

  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },

  zoomImage: {
    width: '100%',
    height: '100%',
  },
});