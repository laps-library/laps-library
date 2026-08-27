import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { GIF_TOP, LOGO_GIF, LOGO_H, LOGO_W } from '../components/gifLayout';

export default function IndexScreen() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function go() {
      let sound: Audio.Sound | null = null;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: s } = await Audio.Sound.createAsync(require('../assets/splash.m4a'));
        sound = s;
        await s.playAsync();
      } catch (e) {}

      await new Promise((r) => setTimeout(r, 4080));

      try { if (sound) await sound.unloadAsync(); } catch (e) {}

      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? '/home' : '/login');
    }

    go();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={LOGO_GIF}
        style={{ position: 'absolute', top: GIF_TOP, width: LOGO_W, height: LOGO_H }}
        resizeMode="contain"
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
});
