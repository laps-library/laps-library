import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as ExpoLinking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  PanResponder,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import Bounceable from "../components/Bounceable";
import { setBallInteraction } from "../components/BounceOverlay";
import { onBannerSwipeUp, onBannerHeight, setBannerMenuOpen } from "../components/MiniPlayer";
import { GIF_TOP, HOME_GIF, HOME_H, HOME_W, W } from "../components/gifLayout";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";

const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView) as any;

function MenuCoverflow({
  items,
}: {
  items: { label: string; action: () => void; active: boolean }[];
}) {
  const SCREEN_W = Dimensions.get("window").width;
  const INNER_W = SCREEN_W - 46;
  const CARD_W = Math.round(INNER_W * 0.42);
  const CARD_MARGIN = 0;
  const SNAP = CARD_W + CARD_MARGIN;
  const SIDE_PAD = (INNER_W - CARD_W) / 2;

  const scrollRef = useRef<any>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const canLoop = items.length > 1;
  const loopedItems = canLoop ? [...items, ...items, ...items] : items;
  const baseOffset = canLoop ? items.length * SNAP : 0;
  const [centerIndex, setCenterIndex] = useState(canLoop ? items.length : 0);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      const idx = Math.round(value / SNAP);
      setCenterIndex((prev) => (prev === idx ? prev : idx));
    });
    return () => scrollX.removeListener(id);
  }, []);

  useEffect(() => {
    if (canLoop && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: baseOffset, animated: false });
        scrollX.setValue(baseOffset);
      });
    }
  }, [items.length]);

  function handleMomentumEnd(e: any) {
    if (!canLoop) return;
    const x = e.nativeEvent.contentOffset.x;
    const n = items.length;
    if (x < n * SNAP * 0.5) {
      const newX = x + n * SNAP;
      scrollRef.current?.scrollTo({ x: newX, animated: false });
      scrollX.setValue(newX);
    } else if (x > n * SNAP * 1.5) {
      const newX = x - n * SNAP;
      scrollRef.current?.scrollTo({ x: newX, animated: false });
      scrollX.setValue(newX);
    }
  }

  return (
    <View>
      <AnimatedGHScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
        contentOffset={{ x: baseOffset, y: 0 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        onMomentumScrollEnd={handleMomentumEnd}
        style={{ overflow: "visible" }}
      >
        {loopedItems.map((item, index) => {
          const inputRange = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];
          const rotateY = scrollX.interpolate({
            inputRange,
            outputRange: ["35deg", "0deg", "-35deg"],
            extrapolate: "clamp",
          });
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.88, 1, 0.88],
            extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.55, 1, 0.55],
            extrapolate: "clamp",
          });
          const translateX = scrollX.interpolate({
            inputRange,
            outputRange: [8, 0, -8],
            extrapolate: "clamp",
          });
          const realIndex = ((index % items.length) + items.length) % items.length;

          return (
            <Animated.View
              key={item.label + "-" + index + "-" + realIndex}
              style={{
                width: CARD_W,
                marginRight: CARD_MARGIN,
                opacity,
                transform: [{ perspective: 600 }, { translateX }, { scale }, { rotateY }],
              }}
            >
              <Pressable
                onPress={() => item.action()}
                style={{ alignItems: "center", paddingVertical: 6 }}
              >
                <Text
                  style={[styles.carouselText, item.active ? { color: "#ff2bd6" } : null]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {item.label}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </AnimatedGHScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const [supervisedPending, setSupervisedPending] = useState<any>(null);
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState("client");
  const [ballMode, setBallMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayMenuIndex, setDisplayMenuIndex] = useState(0);
  const [incomingMenuIndex, setIncomingMenuIndex] = useState<number | null>(null);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const flipBusy = useRef(false);
  const [bannerH, setBannerH] = useState(70);
  useEffect(() => onBannerHeight(setBannerH), []);
  useEffect(() => {
    setBannerMenuOpen(true);
    return () => setBannerMenuOpen(false);
  }, []);
  const menuAnim = useRef(new Animated.Value(0)).current;

  function openMenu() {
    setMenuOpen(true);
    setBannerMenuOpen(true);
    Animated.timing(menuAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }
  function closeMenu() {
    Animated.timing(menuAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() =>
      setMenuOpen(false),
    );
    setBannerMenuOpen(false);
  }

  useEffect(() => onBannerSwipeUp(openMenu), []);

  const carouselSwipe = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) => Math.abs(gs.dx) > 8,
      onPanResponderRelease: (_e, gs) => {
        if (gs.dx < -20) carouselStep(1);
        if (gs.dx > 20) carouselStep(-1);
      },
    }),
  ).current;

  useEffect(() => {
    async function load() {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("role, plan_id, subscription_expires_at")
        .eq("id", uid)
        .single();
      setRole(p?.role ?? "client");

      const { data: supResa } = await supabase
        .from("reservations")
        .select("*, slot_types(code)")
        .eq("user_id", uid)
        .eq("status", "pending_payment")
        .order("created_at", { ascending: false })
        .limit(1);
      setSupervisedPending(
        (supResa ?? []).find((r: any) => r.slot_types?.code === "supervised") ?? null,
      );
      if (p?.plan_id) {
        const { data: pl } = await supabase.from("plans").select("*").eq("id", p.plan_id).single();
        const isFree = pl && (pl.price_cents === 0 || /newbie/i.test(pl.name));
        if (!isFree) {
          const exp = p.subscription_expires_at ? new Date(p.subscription_expires_at).getTime() : 0;
          if (exp <= Date.now()) {
            router.replace("/waiting-payment");
            return;
          }
        }
      }
    }
    load();
  }, []);

  const [showScaleBubble, setShowScaleBubble] = useState(false);
  const [scale, setScale] = useState("Pentatonique");

  function toggleBallMode() {
    if (ballMode) {
      setBallMode(false);
      setBallInteraction(false);
    } else {
      setShowScaleBubble(true);
    }
  }

  function startBallGame() {
    AsyncStorage.setItem("ball_scale", scale);
    setShowScaleBubble(false);
    setBallMode(true);
    setBallInteraction(true);
  }

  const menuItems = [
    ...(role !== "client"
      ? [{ label: "_Administration", action: () => router.push("/admin"), active: false }]
      : []),
    { label: "_Catalogue", action: () => router.push("/catalog"), active: false },
    { label: "_Réserver", action: () => router.push("/reserve"), active: false },
    { label: "_Mon profil", action: () => router.push("/profile"), active: false },
    { label: "_Actualités", action: () => router.push("/news"), active: false },
    { label: "_Forum", action: () => router.push("/forum"), active: false },
    { label: "_Play", action: toggleBallMode, active: ballMode },
  ];
  const menuCount = menuItems.length;
  const currentMenuItem = menuItems[((displayMenuIndex % menuCount) + menuCount) % menuCount];
  const incomingMenuItem =
    incomingMenuIndex === null
      ? null
      : menuItems[((incomingMenuIndex % menuCount) + menuCount) % menuCount];

  const outRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "90deg", "90deg"],
  });
  const outOpacity = flipAnim.interpolate({
    inputRange: [0, 0.45, 0.5, 1],
    outputRange: [1, 0, 0, 0],
  });
  const inRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-90deg", "-90deg", "0deg"],
  });
  const inOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.6, 1],
    outputRange: [0, 0, 1, 1],
  });

  function carouselStep(delta: number) {
    if (flipBusy.current || menuCount === 0) return;
    flipBusy.current = true;
    setIncomingMenuIndex(displayMenuIndex + delta);
    flipAnim.setValue(0);
    Animated.timing(flipAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start(() => {
      setDisplayMenuIndex((i) => (((i + delta) % menuCount) + menuCount) % menuCount);
      setIncomingMenuIndex(null);
      flipBusy.current = false;
    });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.gifOverlay, { top: GIF_TOP + insets.top }]}>
        <Bounceable inset={0.3}>
          <Image source={HOME_GIF} style={{ width: HOME_W, height: HOME_H }} resizeMode="contain" />
        </Bounceable>
      </View>
      <StatusBar style="light" />

      <View style={styles.carouselFrame}>
        <MenuCoverflow items={menuItems} />
      </View>

      {showScaleBubble && (
        <View style={styles.bubbleOverlay}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleTitle}>GAMME DU JEU</Text>
            <Text style={styles.bubbleHelp}>
              Touche l'écran pour lancer des balles sonores.{"\n"}
              Chaque rebond joue une note de la gamme choisie.
            </Text>
            <View style={styles.bubbleRow}>
              {["Pentatonique", "Majeure", "Mineure", "Blues"].map((s) => (
                <Pressable
                  key={s}
                  style={[styles.bubbleChip, scale === s && styles.bubbleChipActive]}
                  onPress={() => setScale(s)}
                >
                  <Text style={[styles.bubbleChipText, scale === s && styles.bubbleChipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.bubbleActions}>
              <Pressable style={styles.bubbleStart} onPress={startBallGame}>
                <Text style={styles.bubbleStartText}>JOUER</Text>
              </Pressable>
              <Pressable style={styles.bubbleClose} onPress={() => setShowScaleBubble(false)}>
                <Text style={styles.bubbleCloseText}>FERMER</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  gifOverlay: {
    position: "absolute",
    top: GIF_TOP,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  container: { flex: 1, backgroundColor: "#000" },
  content: { flexGrow: 1, paddingHorizontal: 8, paddingTop: 24, gap: 0, paddingBottom: 0 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center" },
  spacer: { flex: 1 },
  rowLine: { flexDirection: "row", gap: 8, marginBottom: 0, marginLeft: -8, marginRight: -8 },
  cell: { flex: 1 },
  bubbleOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    paddingBottom: 40,
    zIndex: 50,
  },
  bubble: {
    marginHorizontal: 24,
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  bubbleTitle: {
    color: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textAlign: "center",
    letterSpacing: 1.5,
    fontSize: 13,
  },
  bubbleHelp: {
    color: "#9a9a9a",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 16,
  },
  bubbleRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  bubbleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#444",
  },
  bubbleChipActive: { backgroundColor: "#ff2bd6", borderColor: "#ff2bd6" },
  bubbleChipText: { color: "#ccc", fontSize: 11, fontWeight: "bold" },
  bubbleChipTextActive: { color: "#000" },
  bubbleActions: { flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  bubbleStart: {
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleStartText: { color: "#000", fontWeight: "bold", fontStyle: "italic", fontSize: 12 },
  bubbleClose: { paddingHorizontal: 12, paddingVertical: 8 },
  bubbleCloseText: { color: "#9a9a9a", fontWeight: "bold", fontSize: 12 },
  menuItem: { paddingVertical: 13, paddingHorizontal: 16 },
  menuSep: { borderTopWidth: 1, borderTopColor: "rgba(255, 43, 214, 0.35)" },
  menuText: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  menuHintWrap: { position: "absolute", left: 0, right: 0, bottom: 2, alignItems: "center" },
  menuHintBar: { width: 24, height: 3, borderRadius: 1.5, backgroundColor: "#ff2bd6" },
  carouselFrame: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: -1,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingVertical: 6,
    paddingHorizontal: 10,
    zIndex: 45,
    overflow: "hidden",
  },
  carouselRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  carouselArrow: {
    color: "#ff2bd6",
    fontSize: 26,
    fontWeight: "bold",
    lineHeight: 28,
    paddingHorizontal: 10,
  },
  carouselCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 24,
  },
  carouselText: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  carouselDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 3,
  },
  carouselDot: {
    color: "rgba(255, 43, 214, 0.35)",
    fontSize: 7,
  },
  carouselDotActive: {
    color: "#ff2bd6",
  },
  carouselIncoming: { position: "absolute", left: 0, right: 0, textAlign: "center" },
});
