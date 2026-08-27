import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, SafeAreaView, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import AppButton from '../components/AppButton';
import Bounceable from '../components/Bounceable';
import { setBallInteraction } from '../components/BounceOverlay';
import { GIF_TOP, HOME_GIF, HOME_H, HOME_W, W } from '../components/gifLayout';

function MarqueeText({ text, speed = 50 }: { text: string; speed?: number }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Estimation fiable de la largeur du texte (9px par caractère avec fontSize 12)
  const estimatedWidth = Math.max(text.length * 9, 500);

  useEffect(() => {
    if (containerWidth === 0) return;
    
    const duration = (estimatedWidth + containerWidth) / speed * 1000;
    translateX.setValue(containerWidth);
    
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: -estimatedWidth,
        duration,
        useNativeDriver: true,
      })
    );
    
    animation.start();
    return () => animation.stop();
  }, [estimatedWidth, containerWidth, speed, translateX]);

  return (
    <View 
      style={styles.marqueeContainer}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text
        style={[styles.marqueeText, { transform: [{ translateX }] }]}
        numberOfLines={1}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

export default function HomeScreen() {
  const [supervisedPending, setSupervisedPending] = useState<any>(null);
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState('client');
  const [ballMode, setBallMode] = useState(false);
  
  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const { data: p } = await supabase.from('profiles').select('role, plan_id, subscription_expires_at').eq('id', uid).single();
      setRole(p?.role ?? 'client');

      const { data: supResa } = await supabase
        .from('reservations')
        .select('*, slot_types(code)')
        .eq('user_id', uid)
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(1);
      setSupervisedPending(
        (supResa ?? []).find((r: any) => r.slot_types?.code === 'supervised') ?? null
      );
      if (p?.plan_id) {
        const { data: pl } = await supabase.from('plans').select('*').eq('id', p.plan_id).single();
        const isFree = pl && (pl.price_cents === 0 || /newbie/i.test(pl.name));
        if (!isFree) {
          const exp = p.subscription_expires_at ? new Date(p.subscription_expires_at).getTime() : 0;
          if (exp <= Date.now()) {
            router.replace('/waiting-payment');
            return;
          }
        }
      }
    }
    load();
  }, []);

  function toggleBallMode() {
    const next = !ballMode;
    setBallMode(next);
    setBallInteraction(next);
  }

  return (
    <View style={styles.root}>
      <View style={styles.comingSoonBanner}>
        <MarqueeText 
          text="ATTENTION → Le LAPS n'est pas encore ouvert. Un mail vous sera envoyé pour vous donner la date d'ouverture du lieu et du système de réservation."
          speed={40}
        />
      </View>
      <View style={styles.gifOverlay}>
        <Bounceable inset={0.3}>
          <Image source={HOME_GIF} style={{ width: HOME_W, height: HOME_H }} resizeMode="contain" />
        </Bounceable>
      </View>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={[styles.content, { paddingTop: GIF_TOP + HOME_H - insets.top + 16 }]}>
          <View style={styles.flex} />

          {role !== 'client' && (
            <AppButton label="Administration" fontSize={14} onPress={() => router.push('/admin')} />
          )}

          {supervisedPending && (
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <AppButton
                label="Payer ton créneau supervisé"
                fontSize={14}
                color="#ff2bd6"
                onPress={async () => {
                  const redirectUrl = ExpoLinking.createURL('payment-success');
                  const sess = await supabase.auth.getSession();
                  const uid = sess.data.session?.user.id;
                  const inv = await supabase.functions.invoke('create_payment', {
                    body: {
                      user_id: uid,
                      amount_cents: supervisedPending.price_cents,
                      label: 'Créneau supervisé',
                      kind: 'reservation',
                      reservation_id: supervisedPending.id,
                      redirect_url: redirectUrl,
                    },
                  });
                  const data = inv.data as any;
                  const error = inv.error;
                  if (error || !data?.url) {
                    Alert.alert('Erreur', error?.message ?? 'url manquante');
                    return;
                  }
                  try { await AsyncStorage.setItem('laps_pending_payment', '1'); } catch (e) {}
                  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
                  if (result.type === 'success') router.replace('/payment-success');
                }}
              />
            </View>
          )}

          <View style={styles.row}>
            <AppButton label="Réserver" fontSize={14} onPress={() => router.push('/reserve')} />
            <View style={styles.spacer} />
            <AppButton label="Actualités" fontSize={14} onPress={() => router.push('/news')} />
          </View>

          <View style={styles.row}>
            <AppButton label="Mon profil" fontSize={14} onPress={() => router.push('/profile')} />
            <View style={styles.spacer} />
            <AppButton label="Forum" fontSize={14} onPress={() => router.push('/forum')} />
          </View>

          <View style={styles.row}>
            <AppButton label="Catalogue" fontSize={14} onPress={() => router.push('/catalog')} />
            <View style={styles.spacer} />
            <AppButton label="Play" fontSize={10} accent={ballMode} onPress={toggleBallMode} />
          </View>
        </ScrollView>
        <StatusBar style="light" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  comingSoonBanner: {
    position: 'absolute',
    top: GIF_TOP - 90,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 14,
    zIndex: 11,
  },
  marqueeContainer: {
    overflow: 'hidden',
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marqueeText: {
    color: '#ff2bd6',
    fontWeight: 'bold',
    fontStyle: 'italic',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 12,
  },
  gifOverlay: { position: 'absolute', top: GIF_TOP, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  container: { flex: 1, backgroundColor: '#000' },
  content: { flexGrow: 1, paddingHorizontal: 8, paddingTop: 24, gap: 4, paddingBottom: 16 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  spacer: { flex: 1 },
});
