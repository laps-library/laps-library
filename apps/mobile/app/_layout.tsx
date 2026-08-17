import { useEffect, useState } from 'react';
import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MiniPlayer from '../components/MiniPlayer';
import BounceOverlay, { ballInteractionOn, spawnBallAt } from '../components/BounceOverlay';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [authed, setAuthed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      setAuthed(!!data.session);
    }
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const showPlayer = authed && pathname !== '/';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: '#000' }} onTouchStart={(e: any) => { if (ballInteractionOn() && pathname === '/home') spawnBallAt(e.nativeEvent.pageX, e.nativeEvent.pageY); }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#000' },
          }}
        />
        {showPlayer && <MiniPlayer />}
        <BounceOverlay />
      </View>
    </GestureHandlerRootView>
  );
}
