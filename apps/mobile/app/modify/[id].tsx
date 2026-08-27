import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import AppButton from '../../components/AppButton';
import BackButton from '../../components/BackButton';

export default function ModifyLoanScreen() {
  const { id } = useLocalSearchParams();
  const [loan, setLoan] = useState<any>(null);
  const [allModels, setAllModels] = useState<any[]>([]);
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [msg, setMsg] = useState('');

  async function loadLoan() {
    const { data } = await supabase
      .from('loans')
      .select('*, physical_units(instrument_model_id, instrument_models(name))')
      .eq('id', id)
      .single();
    setLoan(data);
    setSelectedWeek(data?.start_date || '');
    setSelectedModelId(data?.physical_units?.instrument_model_id || '');
  }

  async function loadModels() {
    const { data } = await supabase
      .from('instrument_models')
      .select('id, name, brand')
      .eq('borrowable', true)
      .order('name');
    setAllModels(data ?? []);
  }

  useEffect(() => {
    loadLoan();
    loadModels();

    // Calculer les 12 prochaines semaines
    const weeks: string[] = [];
    const today = new Date();
    for (let i = 1; i <= 12; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + (i * 7));
      const day = weekStart.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);
      weeks.push(weekStart.toISOString().split('T')[0]);
    }
    setAvailableWeeks(weeks);
  }, [id]);

  async function saveChanges() {
    if (!selectedWeek) {
      setMsg('Veuillez sélectionner une semaine.');
      return;
    }

    const dueAt = new Date(selectedWeek);
    dueAt.setDate(dueAt.getDate() + 7);

    // Mettre à jour le prêt
    const { error } = await supabase
      .from('loans')
      .update({
        start_date: selectedWeek,
        due_at: dueAt.toISOString(),
      })
      .eq('id', id);

    if (error) {
      setMsg('Erreur : ' + error.message);
      return;
    }

    // Si l'instrument a changé, trouver une nouvelle unité disponible
    if (selectedModelId && loan?.physical_units?.instrument_model_id !== selectedModelId) {
      const { data: newUnit } = await supabase
        .from('physical_units')
        .select('id')
        .eq('instrument_model_id', selectedModelId)
        .eq('is_borrowable', true)
        .eq('status', 'available')
        .limit(1)
        .maybeSingle();

      if (!newUnit) {
        setMsg("Aucune unité disponible pour cet instrument.");
        return;
      }

      await supabase
        .from('loans')
        .update({ physical_unit_id: newUnit.id })
        .eq('id', id);
    }

    setMsg('Modifications enregistrées.');
    setTimeout(() => loadLoan(), 1000);
  }

  if (!loan) return null;

  const instrName = loan.physical_units?.instrument_models?.name || 'Instrument';

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Modifier l'emprunt</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Instrument</Text>
          <Text style={styles.value}>{instrName}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Changer d'instrument</Text>
          {allModels.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => setSelectedModelId(m.id)}
              style={[
                styles.modelChip,
                {
                  borderColor: selectedModelId === m.id ? '#ff2bd6' : '#444',
                  backgroundColor: selectedModelId === m.id ? 'rgba(255,43,214,0.1)' : 'transparent',
                },
              ]}
            >
              <Text style={{
                color: selectedModelId === m.id ? '#ff2bd6' : '#999',
                fontSize: 13,
                fontWeight: selectedModelId === m.id ? '600' : '400',
              }}>
                {m.name} {m.brand ? `(${m.brand})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Semaine de début</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availableWeeks.map((week) => {
              const date = new Date(week);
              const label = date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              });

              return (
                <TouchableOpacity
                  key={week}
                  onPress={() => setSelectedWeek(week)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selectedWeek === week ? '#ff2bd6' : '#444',
                    backgroundColor: selectedWeek === week ? 'rgba(255,43,214,0.1)' : 'transparent',
                  }}
                >
                  <Text style={{
                    color: selectedWeek === week ? '#ff2bd6' : '#999',
                    fontWeight: selectedWeek === week ? '600' : '400',
                  }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {msg && <Text style={styles.msg}>{msg}</Text>}

        <AppButton label="Enregistrer les modifications" onPress={saveChanges} />
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, gap: 16 },
  title: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 24, color: '#fff', letterSpacing: 1 },
  card: { borderWidth: 1, borderColor: '#fff', borderRadius: 12, padding: 16, gap: 8 },
  label: { color: '#8e8e93', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontStyle: 'italic' },
  value: { color: '#fff', fontSize: 16, fontWeight: '600', fontStyle: 'italic' },
  modelChip: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  msg: { color: '#f87171', fontSize: 13, textAlign: 'center', marginTop: 8 },
});
