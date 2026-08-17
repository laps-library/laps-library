import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AppButton from '../../components/AppButton';
import BackButton from '../../components/BackButton';

function dateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ModifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [res, setRes] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [date, setDate] = useState('');
  const [slotId, setSlotId] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('reservations')
        .select('*, workstations(name), time_slots(id, name, start_time, end_time)')
        .eq('id', id)
        .single();
      setRes(data);
      setDate(data?.reservation_date ?? '');
      setSlotId(data?.time_slot_id ?? '');
      const { data: sl } = await supabase.from('time_slots').select('*').order('start_time');
      setSlots(sl ?? []);
    }
    load();
  }, [id]);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });

  const slot = slots.find((s) => s.id === slotId);

  async function save() {
    if (!date || !slotId) { setMsg('Choisis une date et un créneau.'); return; }
    const { error } = await supabase.from('reservations').update({
      reservation_date: date,
      time_slot_id: slotId,
      start_time: slot?.start_time,
      end_time: slot?.end_time,
    }).eq('id', id);
    if (error) setMsg('Erreur : ' + error.message);
    else {
      setMsg('Réservation modifiée');
      setTimeout(() => router.back(), 800);
    }
  }

  if (!res) return null;

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Modifier</Text>
        <Text style={styles.info}>{res.workstations?.name}</Text>

        <Text style={styles.label}>_Nouvelle date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {days.map((d) => (
            <AppButton
              key={dateStr(d)}
              label={d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
              active={date === dateStr(d)}
              onPress={() => setDate(dateStr(d))}
            />
          ))}
        </ScrollView>

        <Text style={styles.label}>_Nouveau créneau</Text>
        {slots.map((s) => (
          <AppButton key={s.id} label={s.name} active={slotId === s.id} onPress={() => setSlotId(s.id)} />
        ))}

        <AppButton label="Enregistrer" onPress={save} />
        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, gap: 10 },
  title: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 26, color: '#fff', paddingBottom: 8, letterSpacing: 1 },
  info: { color: '#fff', fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 1 },
  label: { color: '#fff', marginTop: 14, marginBottom: 4, fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  msg: { color: '#fff', textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
});
