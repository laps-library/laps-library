import { useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import BackButton from '../components/BackButton';

export default function MyLoansScreen() {
  const [loans, setLoans] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const { data } = await supabase
        .from('loans')
        .select('*, instrument_models(name, brand)')
        .eq('user_id', sess.session?.user.id)
        .order('created_at', { ascending: false });
      setLoans(data ?? []);
    }
    load();
  }, []);

  const label = (s: string) =>
    s === 'requested' ? 'Demande en attente' : s === 'ongoing' ? 'En cours' : 'Retourné';

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <Text style={styles.title}>_Mes emprunts</Text>
      <FlatList
        data={loans}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Aucun emprunt.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.instrument_models?.name}</Text>
            <Text style={styles.meta}>{item.instrument_models?.brand}</Text>
            <Text style={styles.meta}>Statut : {label(item.status)}</Text>
            {item.due_at ? (
              <Text style={styles.meta}>À retourner le {new Date(item.due_at).toLocaleDateString()}</Text>
            ) : null}
          </View>
        )}
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 26, color: '#fff', paddingHorizontal: 24, paddingBottom: 8, letterSpacing: 1 },
  list: { padding: 24, gap: 12 },
  empty: { color: '#8e8e93', fontStyle: 'italic' },
  card: { borderWidth: 1, borderColor: '#fff', borderRadius: 12, padding: 14, gap: 4, backgroundColor: '#000' },
  name: { fontSize: 17, fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', color: '#fff', letterSpacing: 1 },
  meta: { color: '#fff', fontSize: 13 },
});