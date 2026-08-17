import { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import AppButton from '../components/AppButton';
import BackButton from '../components/BackButton';

export default function ForumScreen() {
  const [threads, setThreads] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from('forum_threads')
      .select('id, title, created_at, profiles(first_name, last_name), forum_posts(id)')
      .order('created_at', { ascending: false });
    setThreads(data ?? []);
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Forum</Text>
        <AppButton label="Nouveau sujet" onPress={() => router.push('/forum-new')} />

        {threads.length === 0 && <Text style={styles.empty}>Aucun sujet. Lance la discussion !</Text>}
        {threads.map((t) => (
          <TouchableOpacity key={t.id} style={styles.card} onPress={() => router.push(`/forum-thread/${t.id}`)}>
            <Text style={styles.name}>{t.title}</Text>
            <Text style={styles.meta}>
              {t.profiles?.first_name} · {new Date(t.created_at).toLocaleDateString('fr-FR')} · {t.forum_posts?.length ?? 0} réponse(s)
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, gap: 12 },
  title: { textAlign: 'center', fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 26, color: '#fff', paddingBottom: 8, letterSpacing: 1 },
  empty: { color: '#8e8e93', fontStyle: 'italic' },
  card: { borderWidth: 1, borderColor: '#fff', borderRadius: 12, padding: 16, gap: 6, backgroundColor: '#000' },
  name: { fontSize: 17, fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', color: '#fff', letterSpacing: 1 },
  meta: { color: '#8e8e93', fontSize: 12 },
});
