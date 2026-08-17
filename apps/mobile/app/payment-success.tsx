import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const FLAG = 'laps_pending_payment';

export default function PaymentSuccessScreen() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const pending = await AsyncStorage.getItem(FLAG).catch(() => null);
      if (!pending) {
        // Recharge sans paiement en cours : retour au splash
        router.replace('/');
        return;
      }
      await AsyncStorage.removeItem(FLAG).catch(() => {});
      setMsg('Vérification du paiement…');
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      let fixed = 0;
      if (uid) {
        try {
          const { data } = await supabase.functions.invoke('verify_payment', { body: { user_id: uid } });
          fixed = (data as any)?.fixed ?? 0;
        } catch (e) {}
      }
      setMsg(fixed > 0 ? '✅ Paiement confirmé !' : 'Paiement annulé ou non finalisé.');
      setTimeout(() => router.replace('/home'), 1400);
    }
    run();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {msg ? <Text style={styles.title}>{msg}</Text> : null}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: '#ff2bd6', fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 20, letterSpacing: 1, textAlign: 'center' },
});
