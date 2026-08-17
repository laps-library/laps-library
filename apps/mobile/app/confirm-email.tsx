import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import AppButton from '../components/AppButton';

export default function ConfirmEmailScreen() {
  const { email } = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function tryEnter() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(email ?? ''),
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
    else router.replace('/home');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Vérifie ta boîte mail</Text>
        <Text style={styles.text}>
          Un lien de confirmation a été envoyé à{'\n'}
          <Text style={styles.email}>{String(email ?? '')}</Text>
        </Text>
        <Text style={styles.text}>Clique sur le lien, puis reviens ici et entre ton mot de passe.</Text>

        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#8e8e93"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <AppButton label={loading ? 'Connexion...' : "J'ai confirmé"} onPress={tryEnter} />
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 24, gap: 16 },
  title: { fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase', fontSize: 24, color: '#fff', letterSpacing: 1, marginTop: 40 },
  text: { color: '#8e8e93', fontSize: 15, lineHeight: 22 },
  email: { color: '#fff', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#fff', borderRadius: 10, padding: 14, fontSize: 16, backgroundColor: '#000', color: '#fff' },
  error: { color: '#fff', textAlign: 'center' },
});
