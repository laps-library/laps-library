import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import AppButton from '../components/AppButton';
import BackButton from '../components/BackButton';

const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function AdminCalendarScreen() {
  const [week, setWeek] = useState(0);
  const [slots, setSlots] = useState<any[]>([]);
  const [capacity, setCapacity] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const start = new Date();
  start.setDate(start.getDate() + week * 7 - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });

  useEffect(() => {
    async function load() {
      const { data: ts } = await supabase.from('time_slots').select('id, name, start_time').order('start_time');
      setSlots(ts ?? []);
      const { count: cw } = await supabase.from('workstations').select('*', { count: 'exact', head: true });
      const { count: cs } = await supabase.from('instrument_models').select('*', { count: 'exact', head: true }).eq('kind', 'premium_station');
      setCapacity((cw ?? 0) + (cs ?? 0));
      const a = dstr(days[0]);
      const b = dstr(days[6]);
      const { data: res } = await supabase
        .from('reservations')
        .select('reservation_date, time_slot_id')
        .neq('status', 'cancelled')
        .gte('reservation_date', a).lte('reservation_date', b);
      const m: Record<string, number> = {};
      for (const r of (res ?? [])) m[r.reservation_date + '|' + r.time_slot_id] = (m[r.reservation_date + '|' + r.time_slot_id] ?? 0) + 1;
      setCounts(m);
    }
    load();
  }, [week]);

  function color(n: number) {
    if (n <= 0) return '#22c55e';
    if (n >= capacity) return '#ef4444';
    return '#f59e0b';
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Calendrier global</Text>
        <View style={styles.nav}>
          <AppButton label="‹ Semaine préc." fontSize={12} onPress={() => setWeek(week - 1)} />
          <AppButton label="Semaine suiv. ›" fontSize={12} onPress={() => setWeek(week + 1)} />
        </View>
        <Text style={styles.range}>{dstr(days[0])} → {dstr(days[6])} · capacité {capacity} postes</Text>
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: '#22c55e' }]} /><Text style={styles.legendTxt}>Libre</Text>
          <View style={[styles.dot, { backgroundColor: '#f59e0b' }]} /><Text style={styles.legendTxt}>Partiel</Text>
          <View style={[styles.dot, { backgroundColor: '#ef4444' }]} /><Text style={styles.legendTxt}>Complet</Text>
        </View>
        {days.map((d) => (
          <View key={dstr(d)} style={styles.day}>
            <Text style={styles.dayTitle}>_{d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</Text>
            <View style={styles.cells}>
              {slots.map((s) => {
                const n = counts[dstr(d) + '|' + s.id] ?? 0;
                return (
                  <View key={s.id} style={[styles.cell, { borderColor: color(n) }]}>
                    <Text style={styles.cellName}>{s.name}</Text>
                    <Text style={[styles.cellCount, { color: color(n) }]}>{n}/{capacity}</Text>
                  </View>
                );
              })}
            </View>
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
  title: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 26, color: '#fff', letterSpacing: 1 },
  nav: { flexDirection: 'row', gap: 10 },
  range: { color: '#8e8e93', fontStyle: 'italic', fontSize: 12 },
  legend: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legendTxt: { color: '#8e8e93', fontSize: 12, fontStyle: 'italic', marginRight: 8 },
  day: { gap: 6 },
  dayTitle: { color: '#ff2bd6', fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 14, letterSpacing: 1 },
  cells: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, borderWidth: 2, borderRadius: 10, padding: 8, gap: 4, backgroundColor: '#000' },
  cellName: { color: '#fff', fontSize: 10, fontStyle: 'italic' },
  cellCount: { fontWeight: 'bold', fontSize: 14 },
});
