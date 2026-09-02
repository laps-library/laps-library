import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Stack, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MiniPlayer from "../components/MiniPlayer";
import AppMenu from "../components/AppMenu";
import BounceOverlay, { ballInteractionOn, spawnBallAt } from "../components/BounceOverlay";
import { supabase } from "../lib/supabase";
import { LanguageProvider } from "../lib/i18n";

const AUTH_ROUTES = ["/", "/login", "/register", "/confirm-email", "/payment-success", "/cgv"];
const SEP = "#ff2bd6";

export default function RootLayout() {
  const [authed, setAuthed] = useState(false);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [playerH, setPlayerH] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      setAuthed(!!data?.session);
    }
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const showPlayer = authed && pathname !== "/";
  const isAuthPage = AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const showMenu = authed && !isAuthPage;

  return (
    <LanguageProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View
        style={styles.container}
        onTouchStart={(e: any) => {
          if (ballInteractionOn() && pathname === "/home")
            spawnBallAt(e.nativeEvent.pageX, e.nativeEvent.pageY);
        }}
      >
        {/* ZONE HAUTE : carrousel de navigation */}
        {showMenu && (
          <View style={[styles.zoneTop, { paddingTop: insets.top }]}>
            <View style={{ height: playerH ? Math.round(playerH * 0.42) : undefined, flex: playerH ? 0 : 1 }}>
              <AppMenu />
            </View>
            <View style={styles.sep} />
          </View>
        )}

        {/* ZONE CENTRALE : contenu de la page */}
        <View style={styles.zoneMiddle}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "none",
              contentStyle: { backgroundColor: "#000" },
            }}
          />
        </View>

        {/* ZONE BASSE : texte défilant + player, fixe */}
        {showPlayer && (
          <View style={styles.zoneBottom}>
            <View
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (playerH !== h) setPlayerH(h);
              }}
            >
              <MiniPlayer />
            </View>
          </View>
        )}

        <BounceOverlay />
      </View>
    </GestureHandlerRootView>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  zoneTop: {
    backgroundColor: "#000",
  },
  zoneMiddle: {
    flex: 1,
    backgroundColor: "#000",
  },
  zoneBottom: {
    backgroundColor: "#000",
  },
  sep: {
    height: 2,
    backgroundColor: SEP,
    opacity: 0.6,
  },
});
