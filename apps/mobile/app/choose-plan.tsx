import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { supabase } from '../lib/supabase';
import AppButton from '../components/AppButton';
import BackButton from '../components/BackButton';

const rank = (n: string) => (/newbie/i.test(n) ? 0 : /pro/i.test(n) ? 1 : /nerd/i.test(n) ? 2 : 0);
const isFreePlan = (p: any) => p.price_cents === 0 || /newbie/i.test(p.name);

export default function ChoosePlanScreen() {
  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const id = sess.session?.user.id ?? null;
    setUid(id);
    if (!id) return;
    const { data: prof } = await supabase.from('profiles').select('plan_id').eq('id', id).single();
    if (prof?.plan_id) {
      const { data: cp } = await supabase.from('plans').select('*').eq('id', prof.plan_id).single();
      setCurrent(cp);
    }
    const { data } = await supabase.from('plans').select('*').order('sort_order');
    setPlans(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') load(); });
    return () => sub.remove();
  }, [load]);

  const currentRank = current ? rank(current.name) : -1;
  const upgrades = currentRank === -1 ? plans.filter((p) => !isFreePlan(p)) : plans.filter((p) => rank(p.name) > currentRank && !isFreePlan(p));
  const canCancel = !!current && /nerd/i.test(current.name);

  async function choose(p: any) {
    if (!uid) { setMsg('Session introuvable, reconnecte-toi.'); return; }
    setLoading(p.id);
    setMsg('Création de la session Stripe...');
    const redirectUrl = ExpoLinking.createURL('payment-success');
    const { data, error } = await supabase.functions.invoke('create_checkout', {
      body: { plan_id: p.id, user_id: uid, redirect_url: redirectUrl },
    });
    if (error) { setLoading(null); setMsg('Erreur fonction : ' + error.message); return; }
    if (!data?.url) { setLoading(null); setMsg('Réponse inattendue : ' + JSON.stringify(data)); return; }
    setMsg('Ouverture de Stripe…');
    await AsyncStorage.setItem('laps_pending_payment', '1');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    setLoading(null);
    if (result.type === 'success') {
      router.replace('/payment-success');
    } else {
      setMsg('Paiement annulé ou non finalisé.');
    }
  }

  async function cancel() {
    const free = plans.find(isFreePlan);
    if (!free || !uid) { setMsg('Formule gratuite introuvable.'); return; }
    const { error } = await supabase.from('profiles').update({ plan_id: free.id, subscription_expires_at: null }).eq('id', uid);
    if (error) setMsg('Erreur : ' + error.message);
    else router.replace('/home');
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Gérer ma formule</Text>
        <Text style={styles.hint}>Formule actuelle : {current?.name ?? 'aucune'}</Text>

        {upgrades.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.price}>
              {p.price_cents != null && p.price_cents > 0
                ? `${(p.price_cents / 100).toFixed(2)} € / ${p.price_period === 'year' ? 'an' : 'mois'}`
                : 'Gratuit'}
            </Text>
            {p.features ? <Text style={styles.features}>{p.features}</Text> : null}
            {/pro/i.test(p.name) && <Text style={styles.features}>_Cartes créneaux PRO : 5 créneaux 62,50 € (12,50 €/créneau) · 10 créneaux 100 € (10 €/créneau), créneaux de 10 h à 15 h.</Text>}
            <AppButton label={loading === p.id ? '...' : 'Upgrader'} fontSize={14} onPress={() => choose(p)} />
          </View>
        ))}
        {upgrades.length === 0 && <Text style={styles.hint}>_Aucun upgrade disponible au-dessus de ta formule.</Text>}

        {canCancel && (
          <AppButton
            label="Résilier mon abonnement"
            onPress={() =>
              Alert.alert('Résilier', 'Tu repasseras à la formule gratuite immédiatement.', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Résilier', style: 'destructive', onPress: cancel },
              ])
            }
          />
        )}

        <AppButton label="Conditions générales de vente" fontSize={12} onPress={() => router.push('/cgv')} />

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, gap: 12 },
  title: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 26, color: '#fff', paddingBottom: 8, letterSpacing: 1 },
  hint: { color: '#8e8e93', fontStyle: 'italic', fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, borderColor: '#ff2bd6', borderRadius: 12, padding: 16, gap: 10, backgroundColor: '#000' },
  name: { fontSize: 17, fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', color: '#fff', letterSpacing: 1 },
  price: { color: '#8e8e93', fontSize: 14 },
  features: { color: '#8e8e93', fontSize: 12, lineHeight: 17 },
  msg: { color: '#fff', textAlign: 'center', marginTop: 8 },
});
