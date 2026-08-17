import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { Link, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import AppButton from '../components/AppButton';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('plans').select('*').order('sort_order');
      setPlans(data ?? []);
      const free = (data ?? []).find((p) => p.price_cents === 0 || /newbie/i.test(p.name));
      if (free) setPlanId(free.id);
    }
    load();
  }, []);

  async function handleRegister() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, phone } },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (uid && planId) {
      await supabase.from('profiles').update({ plan_id: planId }).eq('id', uid);
      const chosen = plans.find((p) => p.id === planId);
      const isFree = chosen && (chosen.price_cents === 0 || /newbie/i.test(chosen.name));
      if (isFree) {
        setLoading(false);
        router.replace('/home');
        return;
      }
      // Formule payante : ouvrir Stripe
      const redirectUrl = ExpoLinking.createURL('payment-success');
      const { data: checkData, error: checkErr } = await supabase.functions.invoke('create_checkout', {
        body: { plan_id: planId, user_id: uid, redirect_url: redirectUrl },
      });
      if (checkData?.url) {
        await AsyncStorage.setItem('laps_pending_payment', '1');
        const result = await WebBrowser.openAuthSessionAsync(checkData.url, redirectUrl);
        setLoading(false);
        if (result.type === 'success') {
          router.replace('/payment-success');
        } else {
          setError('Paiement annulé ou non finalisé.');
        }
      } else {
        setLoading(false);
        let detail = checkErr?.message || 'inconnu';
        try {
          if (checkErr?.context) {
            const j = await checkErr.context.json();
            detail = JSON.stringify(j);
          }
        } catch (e) {}
        setError('PAIEMENT : ' + detail);
      }
    } else {
      setLoading(false);
      router.replace(`/confirm-email?email=${encodeURIComponent(email)}`);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.subtitle}>Inscription</Text>

        <TextInput style={styles.input} placeholder="Prénom" placeholderTextColor="#8e8e93" value={firstName} onChangeText={setFirstName} />
        <TextInput style={styles.input} placeholder="Nom" placeholderTextColor="#8e8e93" value={lastName} onChangeText={setLastName} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#8e8e93" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Téléphone" placeholderTextColor="#8e8e93" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor="#8e8e93" secureTextEntry value={password} onChangeText={setPassword} />

        <Text style={styles.planTitle}>_Ta formule</Text>
        {plans.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.planCard, planId === p.id && styles.planCardSelected]}
            onPress={() => setPlanId(p.id)}
          >
            <Text style={styles.planName}>{p.name}</Text>
            <Text style={styles.planPrice}>
              {p.price_cents != null && p.price_cents > 0 ? `${(p.price_cents / 100).toFixed(2)} € / ${p.price_period === 'year' ? 'an' : 'mois'}` : 'Gratuit'}
            </Text>
            {p.features ? <Text style={styles.planFeatures}>{p.features}</Text> : null}
          </TouchableOpacity>
        ))}

        {error && <Text style={styles.error}>{error}</Text>}

        <AppButton label={loading ? 'Création...' : 'Créer mon compte'} onPress={handleRegister} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Déjà un compte ?</Text>
          <Link href="/login" style={styles.link}>_Se connecter</Link>
        </View>
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, gap: 12 },
  logo: { width: '100%', height: 200, alignSelf: 'center', marginTop: 40, marginBottom: 8 },
  subtitle: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 20, letterSpacing: 1 },
  input: { borderWidth: 1, borderColor: '#fff', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#000', color: '#fff' },
  planTitle: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 18, color: '#fff', marginTop: 8, letterSpacing: 1 },
  planCard: { borderWidth: 1, borderColor: '#444', borderRadius: 12, padding: 14, gap: 4, backgroundColor: '#000' },
  planCardSelected: { borderWidth: 2, borderColor: '#ff2bd6', backgroundColor: '#000' },
  planName: { fontSize: 16, fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', color: '#fff', letterSpacing: 1 },
  planPrice: { color: '#8e8e93', fontSize: 13 },
  planFeatures: { color: '#8e8e93', fontSize: 12, lineHeight: 17 },
  error: { color: '#fff', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 6 },
  footerText: { color: '#fff' },
  link: { color: '#fff', fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase' },
});
