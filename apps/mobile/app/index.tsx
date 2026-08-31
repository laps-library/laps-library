import { useEffect, useRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { supabase } from "../lib/supabase";
import { GIF_TOP, LOGO_GIF, LOGO_H, LOGO_W } from "../components/gifLayout";

export default function IndexScreen() {
  const insets = useSafeAreaInsets();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function go() {
      let player: any = null;
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        player = createAudioPlayer(require("../assets/splash.m4a"));
        player.play();
      } catch (e) {}

      await new Promise((r) => setTimeout(r, 4080));

      try {
        if (player) player.remove();
      } catch (e) {}

      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? "/home" : "/login");
    }

    go();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={LOGO_GIF}
        style={{ position: "absolute", top: GIF_TOP + insets.top, width: LOGO_W, height: LOGO_H }}
        resizeMode="contain"
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", alignItems: "center" },
});
