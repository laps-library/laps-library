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
import { configureBallMusic, noteName, SCALE_NAMES, setWallMode } from "../components/ballAudio";
import { startGame, endGame, onGameStateChange, setScoreSave } from "../components/ballGame";
import { GIF_TOP, HOME_GIF, HOME_H, HOME_W, W } from "../components/gifLayout";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";

const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView) as any;

function MenuCoverflow({
  items,
}: {
  items: { label: string; action: () => void; active: boolean }[];
}) {
  const SCREEN_W = Dimensions.get("window").width;
  const INNER_W = SCREEN_W - 54;
  const CARD_W = Math.round(INNER_W * 0.32);
  const CARD_MARGIN = 6;
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
        style={{ overflow: "hidden" }}
      >
        {loopedItems.map((item, index) => {
          const inputRange = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];
          const rotateY = scrollX.interpolate({
            inputRange,
            outputRange: ["25deg", "0deg", "-25deg"],
            extrapolate: "clamp",
          });
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.92, 1, 0.92],
            extrapolate: "clamp",
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.65, 1, 0.65],
            extrapolate: "clamp",
          });
          const translateX = scrollX.interpolate({
            inputRange,
            outputRange: [4, 0, -4],
            extrapolate: "clamp",
          });
          const textScale = scrollX.interpolate({
            inputRange,
            outputRange: [0.75, 1.15, 0.75],
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
                <Animated.Text
                  style={[
                    styles.carouselText,
                    { transform: [{ scale: textScale }] },
                    item.active ? { color: "#ff2bd6" } : null,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {item.label}
                </Animated.Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </AnimatedGHScrollView>
      <LinearGradient
        colors={["#000", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", left: -14, top: 0, bottom: 0, width: 34 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "#000"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: "absolute", right: -14, top: 0, bottom: 0, width: 34 }}
        pointerEvents="none"
      />
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

  useEffect(() => {
    if (!showScaleBubble) return;
    (async () => {
      const { data } = await supabase
        .from("ball_scores")
        .select("score, pseudo, profiles(pseudo)")
        .order("score", { ascending: false })
        .limit(10);
      setTopScores((data ?? []) as any[]);
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (uid) {
        const { data: mine } = await supabase
          .from("ball_scores")
          .select("score")
          .eq("user_id", uid)
          .order("score", { ascending: false })
          .limit(1);
        setMyBest(mine && mine.length ? mine[0].score : null);
      }
    })();
  }, [showScaleBubble]);

  useEffect(
    () =>
      onGameStateChange((s) => {
        if (s.over) {
          setBallMode(false);
          setBallInteraction(false);
        }
      }),
    []
  );

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
      setUserId(uid);
      const { data: pSettings } = await supabase
        .from("profiles")
        .select("music_root, music_scale")
        .eq("id", uid)
        .single();
      if (pSettings) {
        setMusicRoot(pSettings.music_root ?? 48);
        setMusicScale(pSettings.music_scale ?? "Pentatonique mineure");
      }
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
  const [musicScale, setMusicScale] = useState<string>("Pentatonique mineure");
  const [musicRoot, setMusicRoot] = useState<number>(48);
  const [wallMode, setWallModeState] = useState<"sequence" | "random">("sequence");
  const [scoreSave, setScoreSaveState] = useState<boolean>(true);
  const [bubblePage, setBubblePage] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [topScores, setTopScores] = useState<any[]>([]);
  const [myBest, setMyBest] = useState<number | null>(null);

  function toggleBallMode() {
    if (ballMode) {
      setBallMode(false);
      setBallInteraction(false);
      endGame();
    } else {
      setShowScaleBubble(true);
    }
  }

  async function changeMusicRoot(d: number) {
    const next = Math.max(0, Math.min(87, musicRoot + d));
    setMusicRoot(next);
    configureBallMusic(next, musicScale);
    if (userId) {
      await supabase.from("profiles").update({ music_root: next }).eq("id", userId);
    }
  }

  async function setMusicScaleChoice(s: string) {
    setMusicScale(s);
    configureBallMusic(musicRoot, s);
    if (userId) {
      await supabase.from("profiles").update({ music_scale: s }).eq("id", userId);
    }
  }

  function startBallGame() {
    AsyncStorage.setItem("ball_scale", musicScale);
    AsyncStorage.setItem("ball_root", String(musicRoot));
    configureBallMusic(musicRoot, musicScale);
    setShowScaleBubble(false);
    setBallMode(true);
    setBallInteraction(true);
    startGame(musicScale, musicRoot);
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
      {!ballMode && (
        <View style={[styles.gifOverlay, { top: GIF_TOP + insets.top }]}>
          <Bounceable inset={0.3}>
            <Image source={HOME_GIF} style={{ width: HOME_W, height: HOME_H }} resizeMode="contain" />
          </Bounceable>
        </View>
      )}
      <StatusBar style="light" />

      {!ballMode && (
        <View style={styles.carouselFrame}>
          <MenuCoverflow items={menuItems} />
        </View>
      )}

      {showScaleBubble && (
        <View style={styles.bubbleOverlay}>
          <View style={styles.bubble}>
            <ScrollView style={{ maxHeight: 430 }} showsVerticalScrollIndicator={false}>
            {bubblePage === 1 && (
              <View>
            <View style={styles.bubbleCard}>
            <Text style={styles.setLabel}>_Fondamentale</Text>
            <View style={styles.bubbleRootRow}>
              <Pressable style={styles.bubbleRootBtn} onPress={() => changeMusicRoot(-1)}>
                <Text style={styles.bubbleRootBtnText}>-</Text>
              </Pressable>
              <Text style={styles.bubbleRootValue}>{noteName(musicRoot)}</Text>
              <Pressable style={styles.bubbleRootBtn} onPress={() => changeMusicRoot(1)}>
                <Text style={styles.bubbleRootBtnText}>+</Text>
              </Pressable>
            </View>
            <View style={styles.setSep} />
            <Text style={styles.setLabel}>_Mélodie des murs</Text>
            <View style={styles.bubbleRow}>
              {(["sequence", "random"] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.bubbleChip, wallMode === m && styles.bubbleChipActive]}
                  onPress={() => {
                    setWallMode(m);
                    setWallModeState(m);
                  }}
                >
                  <Text style={[styles.bubbleChipText, wallMode === m && styles.bubbleChipTextActive]}>
                    {m === "sequence" ? "SEQUENCE" : "ALEATOIRE"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.setSep} />
            <Text style={styles.setLabel}>_Gamme</Text>
            <View style={styles.bubbleRow}>
              {SCALE_NAMES.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.bubbleChip, musicScale === s && styles.bubbleChipActive]}
                  onPress={() => setMusicScaleChoice(s)}
                >
                  <Text style={[styles.bubbleChipText, musicScale === s && styles.bubbleChipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
            </View>
              </View>
            )}
            {bubblePage === 0 && (
              <View>
                <Text style={styles.bubbleTitle}>COMMENT JOUER</Text>
                <View style={styles.bubbleCard}>
                  <Text style={styles.bubbleLine}>- Touche l'écran : lancer la balle</Text>
                  <Text style={styles.bubbleLine}>- Glisse le doigt : déplacer la raquette</Text>
                  <Text style={styles.bubbleLine}>- Touche une balle en jeu : la démultiplie (1 à 3)</Text>
                  <Text style={styles.bubbleLine}>- Bloc blanc : +1 balle · Bloc plein : 2 coups</Text>
                  <Text style={styles.bubbleLine}>- Rangée complète : arpège + bonus</Text>
                  <Text style={styles.bubbleLine}>- Capsules : R+ large · RA ralenti · FEU traverse · x3 multi · +1 vie · R- piège</Text>
                  <Text style={styles.bubbleLine}>- Combo : enchaîne les blocs sans rater, la balle accélère</Text>
                  <Text style={styles.bubbleLine}>- Balle ratée : -1 vie · 30 s par niveau</Text>
                  <Text style={styles.bubbleLine}>- Murs : mélodie de la gamme (séquence ou aléatoire)</Text>
                  <Text style={styles.bubbleLine}>- Fin de partie : ta musique peut être enregistrée en .mid via la feuille de partage</Text>
                  <Text style={styles.bubbleLine}>- Choisis si ton score entre au classement</Text>
                </View>
              </View>
            )}
            {bubblePage === 1 && (
              <View>
            <View style={styles.bubbleCard}>
            <Text style={styles.setLabel}>_Mon score</Text>
            <View style={styles.bubbleRow}>
              {([true, false] as const).map((v) => (
                <Pressable
                  key={String(v)}
                  style={[styles.bubbleChip, scoreSave === v && styles.bubbleChipActive]}
                  onPress={() => {
                    setScoreSave(v);
                    setScoreSaveState(v);
                  }}
                >
                  <Text style={[styles.bubbleChipText, scoreSave === v && styles.bubbleChipTextActive]}>
                    {v ? "CLASSE" : "ANONYME"}
                  </Text>
                </Pressable>
              ))}
            </View>
              </View>
            </View>
            )}
            {bubblePage === 2 && (
              <View>
            <Text style={styles.bubbleTitle}>CLASSEMENT</Text>
            {topScores.length === 0 ? (
              <Text style={styles.bubbleHelp}>Aucun score enregistre. Sois le premier !</Text>
            ) : (
              <View style={{ gap: 3 }}>
                {topScores.map((s: any, i: number) => (
                  <View key={i} style={styles.scoreRow}>
                    <Text style={styles.scoreRank}>{i + 1}.</Text>
                    <Text style={styles.scoreName} numberOfLines={1}>
                      {s.pseudo ?? s.profiles?.pseudo ?? "Joueur"}
                    </Text>
                    <Text style={styles.scoreVal}>{s.score}</Text>
                  </View>
                ))}
              </View>
            )}
            {myBest !== null && (
              <Text style={styles.bubbleHelp}>Ton record : {myBest} pts</Text>
            )}
              </View>
            )}
            </ScrollView>
            <View style={styles.bubbleTabs}>
              {["REGLES", "REGLAGES", "CLASSEMENT"].map((t, i) => (
                <Pressable
                  key={t}
                  style={[styles.bubbleTab, bubblePage === i && styles.bubbleTabActive]}
                  onPress={() => setBubblePage(i)}
                >
                  <Text style={[styles.bubbleTabText, bubblePage === i && styles.bubbleTabTextActive]}>
                    {t}
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
    borderColor: "rgba(255,255,255,0.5)",
  },
  bubbleChipActive: { backgroundColor: "rgba(255,43,214,0.12)", borderColor: "#ff2bd6" },
  bubbleRootRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginVertical: 4 },
  bubbleRootBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "#ff2bd6", alignItems: "center", justifyContent: "center" },
  bubbleRootBtnText: { color: "#ff2bd6", fontSize: 20, fontWeight: "bold", lineHeight: 22 },
  bubbleRootValue: { color: "#fff", fontWeight: "bold", fontStyle: "italic", fontSize: 18, letterSpacing: 1, minWidth: 50, textAlign: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bubbleCard: { borderWidth: 1, borderColor: "#ff2bd6", borderRadius: 12, padding: 14, backgroundColor: "#000", marginBottom: 8 },
  setLabel: { fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase", fontSize: 10, color: "#fff", letterSpacing: 1, marginBottom: 8 },
  setSep: { borderTopWidth: 1, borderTopColor: "rgba(255,43,214,0.35)", marginVertical: 12 },
  bubbleLine: { color: "#ccc", fontSize: 11, fontStyle: "italic", lineHeight: 16, marginBottom: 7, textAlign: "left" },
  bubbleTabs: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 10 },
  bubbleTab: { borderWidth: 1, borderColor: "#444", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  bubbleTabActive: { borderColor: "#ff2bd6", backgroundColor: "rgba(255,43,214,0.15)" },
  bubbleTabText: { color: "#8e8e93", fontSize: 10, fontWeight: "bold", fontStyle: "italic", letterSpacing: 1 },
  bubbleTabTextActive: { color: "#ff2bd6" },
  scoreRank: { color: "#ff2bd6", fontWeight: "bold", fontStyle: "italic", fontSize: 12, width: 20 },
  scoreName: { color: "#fff", fontWeight: "bold", fontStyle: "italic", fontSize: 12, flex: 1 },
  scoreVal: { color: "#ff2bd6", fontWeight: "bold", fontSize: 12 },
  bubbleChipText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  bubbleChipTextActive: { color: "#ff2bd6" },
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
    paddingHorizontal: 14,
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
