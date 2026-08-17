import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import AppButton from '../components/AppButton';
import BackButton from '../components/BackButton';

type Res = {
  id: string; reservation_date: string; start_time: string; price_cents: number; status: string;
  workstations: { name: string }; time_slots: { name: string }; instrument_models?: { name: string };
};

const H16 = 16 * 3600 * 1000;

export default function MyReservations() {
  const [list, setList] = useState<Res[]>([]);

  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      const { data } = await supabase
        .from('reservations')
        .select('id, reservation_date, start_time, price_cents, status, workstations(name), time_slots(name), instrument_models(name)')
        .eq('user_id', uid)
        .order('reservation_date');
      setList((data as Res[]) ?? []);
    }
    load();
  }, []);

  function canModify(r: Res) {
    const start = new Date(`${r.reservation_date}T${r.start_time}`);
    return start.getTime() - Date.now() > H16 && (r.status === 'confirmed' || r.status === 'pending_validation');
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Mes réservations</Text>
        {list.length === 0 && <Text style={styles.empty}>Aucune réservation.</Text>}
        {list.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.name}>{(r as any).instrument_models?.name ? (r as any).instrument_models.name.replace('Poste Premium — ', '') : r.workstations?.name}</Text>
            <Text style={styles.info}>{new Date(r.reservation_date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</Text>
            <Text style={styles.info}>{r.time_slots?.name}</Text>
            <Text style={styles.price}>{r.price_cents / 100}€ — {r.status}</Text>
            {canModify(r) && (
              <AppButton label="Modifier" onPress={() => router.push(`/modify/${r.id}`)} />
            )}
          </View>
        ))}
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, gap: 12 },
  title: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 26, color: '#fff', paddingBottom: 8, letterSpacing: 1 },
  empty: { color: '#8e8e93', fontStyle: 'italic' },
  card: { borderWidth: 1, borderColor: '#fff', borderRadius: 12, padding: 16, gap: 6, backgroundColor: '#000' },
  name: { fontSize: 18, fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', color: '#fff', letterSpacing: 1 },
  info: { color: '#fff' },
  price: { color: '#fff', fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 1 },
});