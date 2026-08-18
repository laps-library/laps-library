import { useEffect, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';
import AppButton from '../components/AppButton';
import BackButton from '../components/BackButton';
import { configureBallMusic, noteName, SCALE_NAMES } from '../components/ballAudio';

async function doLogout() {
  await supabase.auth.signOut();
  router.replace('/login');
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<any>(null);
  const [pseudo, setPseudo] = useState('');
  const [plan, setPlan] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    setProfile(data);
    setPseudo(data?.pseudo ?? '');
    if (data?.plan_id) {
      const { data: pl } = await supabase.from('plans').select('*').eq('id', data.plan_id).single();
      setPlan(pl);
    }
    const { data: res } = await supabase
      .from('reservations')
      .select('id, reservation_date, start_time, status, workstations(name), time_slots(name), instrument_models(name)')
      .eq('user_id', uid)
      .order('reservation_date')
      .limit(5);
    setReservations(res ?? []);
    const { data: ln } = await supabase
      .from('loans')
      .select('id, status, duration_weeks, instrument_models(name)')
      .eq('user_id', uid)
      .neq('status', 'returned')
      .limit(5);
    setLoans(ln ?? []);
  }

  useEffect(() => { load(); }, []);

  async function savePseudo() {
    const value = pseudo.trim();
    if (value && (value.length < 2 || value.length > 30)) {
      Alert.alert('Pseudo invalide', 'Le pseudo doit faire entre 2 et 30 caractères.');
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({ pseudo: value || null })
      .eq('id', profile.id);
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        Alert.alert('Pseudo déjà pris', 'Ce pseudo est déjà utilisé. Choisis-en un autre.');
      } else {
        Alert.alert('Erreur', error.message);
      }
      return;
    }
    Alert.alert('Enregistré', 'Ton pseudo public a été mis à jour.');
    load();
  }

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const file = res.assets[0];
    setUploading(true);
    try {
      const resp = await fetch(file.uri);
      const blob = await resp.blob();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${profile.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('id-documents').upload(path, blob, { upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from('profiles').update({
        id_document_url: path,
        id_document_status: 'pending',
        id_uploaded_at: new Date().toISOString(),
      }).eq('id', profile.id);
      if (dbErr) { Alert.alert('Erreur DB', dbErr.message); return; }
      Alert.alert('Envoyé', "Votre pièce d'identité sera vérifiée par un administrateur.");
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || "Échec de l'envoi.");
    } finally {
      setUploading(false);
    }
  }

  async function viewDocument() {
    if (!profile?.id_document_url) return;
    const { data } = await supabase.storage.from('id-documents').createSignedUrl(profile.id_document_url, 3600);
    if (data?.signedUrl) Linking.openURL(data.signedUrl);
  }

  async function changeRoot(d: number) {
    const cur = profile.music_root ?? 48;
    const next = Math.max(0, Math.min(87, cur + d));
    setProfile({ ...profile, music_root: next });
    configureBallMusic(next, profile.music_scale ?? 'Pentatonique mineure');
    await supabase.from('profiles').update({ music_root: next }).eq('id', profile.id);
  }

  async function cycleScale() {
    const cur = profile.music_scale ?? 'Pentatonique mineure';
    const idx = SCALE_NAMES.indexOf(cur);
    const next = SCALE_NAMES[(idx + 1) % SCALE_NAMES.length];
    setProfile({ ...profile, music_scale: next });
    configureBallMusic(profile.music_root ?? 48, next);
    await supabase.from('profiles').update({ music_scale: next }).eq('id', profile.id);
  }

  const statusLabel = (s: string | null) =>
    s === 'verified' ? 'Vérifiée' : s === 'rejected' ? 'Refusée' : s === 'pending' ? 'En attente' : 'Non envoyée';

  const isFree = plan && (plan.price_cents === 0 || /gratuite|newbie/i.test(plan.name));
  const validity = profile?.subscription_expires_at
    ? `Valable jusqu'au ${new Date(profile.subscription_expires_at).toLocaleDateString('fr-FR')}`
    : isFree
      ? 'Sans expiration'
      : 'Activation en attente';

  async function handleDelete() {
    Alert.alert('Supprimer mon compte', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
          await supabase.rpc('delete_own_account');
          await supabase.auth.signOut();
          router.replace('/login');
        } },
    ]);
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide} />
          <Text style={styles.title}>_Mon profil</Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            {plan ? <Text style={styles.planBadge}>{plan.name}</Text> : null}
          </View>
        </View>

        <View style={styles.bigCard}>
          <Text style={styles.section}>_Mon abonnement</Text>
          <Text style={styles.value}>{validity}</Text>
          <AppButton label={/nerd/i.test(plan?.name ?? '') ? 'Résilier mon abonnement' : 'Gérer mon abonnement'} onPress={() => router.push('/choose-plan')} />
          <AppButton label="Supprimer mon compte" onPress={handleDelete} />

          <Text style={styles.section}>_Ma musique</Text>
          <View style={styles.bigCard}>
            <Text style={styles.label}>_Fondamentale</Text>
            <Text style={styles.value}>{noteName(profile.music_root ?? 48)}</Text>
            <View style={styles.row}>
              <AppButton label="Note −" fontSize={12} onPress={() => changeRoot(-1)} />
              <AppButton label="Note +" fontSize={12} onPress={() => changeRoot(1)} />
            </View>
            <Text style={styles.label}>_Gamme</Text>
            <Text style={styles.value}>{profile.music_scale ?? 'Pentatonique mineure'}</Text>
            <AppButton label="Gamme suivante" fontSize={12} onPress={cycleScale} />
          </View>

          <Text style={styles.section}>_Infos personnelles</Text>
          <Text style={styles.label}>_Prénom</Text>
          <Text style={styles.value}>{profile.first_name}</Text>
          <Text style={styles.label}>_Nom</Text>
          <Text style={styles.value}>{profile.last_name}</Text>
          <Text style={styles.label}>_Email</Text>
          <Text style={styles.value}>{profile.email}</Text>
          <Text style={styles.label}>_Téléphone</Text>
          <Text style={styles.value}>{profile.phone || '-'}</Text>

          <Text style={styles.section}>_Pseudo public</Text>
          <Text style={styles.label}>_Affiché sur le forum</Text>
          <TextInput
            style={styles.input}
            value={pseudo}
            onChangeText={setPseudo}
            placeholder="Choisis un pseudo public"
            placeholderTextColor="#8e8e93"
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <AppButton label="Enregistrer mon pseudo" onPress={savePseudo} />

          <Text style={styles.section}>_Mes réservations</Text>
          {reservations.length === 0 && <Text style={styles.empty}>Aucune réservation à venir.</Text>}
          {reservations.map((r) => (
            <Text key={r.id} style={styles.line}>
              _ {new Date(r.reservation_date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })} · {r.time_slots?.name} · {r.instrument_models?.name ? r.instrument_models.name.replace('Poste Premium — ', '') : r.workstations?.name}
            </Text>
          ))}
          <AppButton label="Gérer mes réservations" fontSize={10} onPress={() => router.push('/my-reservations')} />

          <Text style={styles.section}>_Mes emprunts</Text>
          {loans.length === 0 && <Text style={styles.empty}>Aucun emprunt en cours.</Text>}
          {loans.map((l) => (
            <Text key={l.id} style={styles.line}>
              _ {l.instrument_models?.name} · {l.duration_weeks ? `${l.duration_weeks} sem · ` : ''}{l.status}
            </Text>
          ))}
          <AppButton label="Gérer mes emprunts" fontSize={10} onPress={() => router.push('/my-loans')} />
        </View>

        <Text style={styles.section}>_Pièce d'identité</Text>
        <View style={styles.card}>
          <Text style={styles.label}>_Statut</Text>
          <Text style={styles.value}>{statusLabel(profile.id_document_status)}</Text>
          {!profile.id_document_url && (
            <AppButton label={uploading ? 'Envoi...' : 'Envoyer ma pièce'} onPress={pickDocument} />
          )}
          {profile.id_document_url && profile.id_document_status !== 'verified' && (
            <AppButton label="Renvoyer une pièce" onPress={pickDocument} />
          )}
          {profile.id_document_url && (
            <AppButton label="Voir ma pièce" onPress={viewDocument} />
          )}
        </View>
        <AppButton label="Se déconnecter" onPress={doLogout} />
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: '#fff', borderRadius: 10, padding: 14, color: '#fff', backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, gap: 12 },
  title: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 28, color: '#fff', letterSpacing: 1, textAlign: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  headerSide: { flex: 1 },
  headerSideRight: { alignItems: 'flex-end' },
  planBadge: { color: '#000', backgroundColor: '#ff2bd6', fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  section: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 17, color: '#ff2bd6', marginTop: 16, marginBottom: 8, letterSpacing: 1 },
  bigCard: { borderWidth: 1, borderColor: '#ff2bd6', borderRadius: 12, padding: 16, gap: 4, backgroundColor: '#000' },
  card: { borderWidth: 1, borderColor: '#fff', borderRadius: 12, padding: 16, gap: 8, backgroundColor: '#000' },
  label: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 10, color: '#8e8e93', letterSpacing: 1 },
  value: { color: '#fff', fontSize: 15, marginBottom: 8 },
  line: { color: '#fff', fontSize: 13, fontStyle: 'italic' },
  empty: { color: '#8e8e93', fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: 8 },
});
