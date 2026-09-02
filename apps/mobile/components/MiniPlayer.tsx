import { useLang } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
const TRACKS = [
  require("../assets/audio/track01.mp3"),
  require("../assets/audio/track02.mp3"),
  require("../assets/audio/track03.mp3"),
  require("../assets/audio/track04.mp3"),
  require("../assets/audio/track05.mp3"),
  require("../assets/audio/track06.mp3"),
];

function randomIndex(except: number) {
  if (TRACKS.length <= 1) return 0;
  let r = Math.floor(Math.random() * TRACKS.length);
  while (r === except) r = Math.floor(Math.random() * TRACKS.length);
  return r;
}

// ===== AUDIO SINGLETON : un seul son pour toute l'app =====
let sound: AudioPlayer | null = null;
let isPlaying = false;
let currentIndex = 0;
let volume = 0.7;
let busy = false;
const history: number[] = [];
const listeners = new Set<(st: { playing: boolean; index: number; volume: number }) => void>();

function emit() {
  const st = { playing: isPlaying, index: currentIndex, volume };
  listeners.forEach((l) => l(st));
}

async function stopSound() {
  if (!sound) return;
  const s = sound;
  sound = null;
  try {
    s.pause();
    s.remove();
  } catch (e) {}
}

async function playAt(i: number, recordHistory = true) {
  if (busy) return;
  busy = true;
  try {
    if (recordHistory && sound) history.push(currentIndex);
    await stopSound();
    await setAudioModeAsync({ playsInSilentMode: true });
    const s = createAudioPlayer(TRACKS[i]);
    s.volume = volume;
    sound = s;
    currentIndex = i;
    s.addListener("playbackStatusUpdate", (status: any) => {
      if (sound === s) {
        isPlaying = !!status.playing;
        emit();
        if (
          status.status === "ended" ||
          (status.duration && status.currentTime >= status.duration - 0.1)
        ) {
          playAt(randomIndex(i), false);
        }
      }
    });
    s.play();
    isPlaying = true;
    emit();
  } catch (e) {
  } finally {
    busy = false;
  }
}

async function toggle() {
  if (!sound) {
    await playAt(randomIndex(currentIndex), false);
    return;
  }
  if (isPlaying) {
    sound.pause();
    isPlaying = false;
    emit();
  } else {
    sound.play();
    isPlaying = true;
    emit();
  }
}

function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (sound) sound.volume = volume;
  emit();
}

function next() {
  playAt(randomIndex(currentIndex));
}
function prev() {
  const last = history.pop();
  playAt(last != null ? last : randomIndex(currentIndex), false);
}

const bannerSwipeListeners = new Set<() => void>();
let lastBannerHeight = 0;
const bannerHeightListeners = new Set<(h: number) => void>();
export function onBannerHeight(fn: (h: number) => void) {
  bannerHeightListeners.add(fn);
  if (lastBannerHeight) fn(lastBannerHeight);
  return () => {
    bannerHeightListeners.delete(fn);
  };
}
export function onBannerSwipeUp(fn: () => void) {
  bannerSwipeListeners.add(fn);
  return () => {
    bannerSwipeListeners.delete(fn);
  };
}

let bannerMenuOpen = false;
const menuOpenListeners = new Set<(o: boolean) => void>();
export function setBannerMenuOpen(o: boolean) {
  bannerMenuOpen = o;
  menuOpenListeners.forEach((f) => f(o));
}

const TRACK_WIDTH = 60;

function VolumeSlider({ live }: { live: number }) {
  function updateFromX(x: number) {
    const v = Math.max(0, Math.min(1, x / TRACK_WIDTH));
    setVolume(v);
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateFromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => updateFromX(e.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View style={styles.track} {...responder.panHandlers}>
      <View style={[styles.trackFill, { width: live * TRACK_WIDTH }]} />
      <View style={[styles.thumb, { left: live * TRACK_WIDTH - 7 }]} />
    </View>
  );
}

function MarqueeNotice({ text }: { text: string }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const estimatedWidth = Math.max(text.length * 8, 500);

  useEffect(() => {
    if (containerWidth === 0) return;
    const duration = ((estimatedWidth + containerWidth) / 40) * 1000;
    translateX.setValue(containerWidth);
    const anim = Animated.loop(
      Animated.timing(translateX, { toValue: -estimatedWidth, duration, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [containerWidth, estimatedWidth, translateX]);

  return (
    <View
      style={styles.marqueeContainer}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.Text style={[styles.noticeText, { transform: [{ translateX }] }]} numberOfLines={1}>
        {text}
      </Animated.Text>
    </View>
  );
}

export default function MiniPlayer() {
  const { t } = useLang();
  const [lineThin, setLineThin] = useState(bannerMenuOpen);
  useEffect(() => {
    const l = (o: boolean) => setLineThin(o);
    menuOpenListeners.add(l);
    return () => {
      menuOpenListeners.delete(l);
    };
  }, []);
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState({ playing: isPlaying, index: currentIndex, volume });

  useEffect(() => {
    const l = (s: any) => setSt(s);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const swipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_e, gs) => {
        if (gs.dy < -15) bannerSwipeListeners.forEach((f) => f());
      },
    }),
  ).current;

  return (
    <View
      style={{ backgroundColor: "#000" }}
      onLayout={(e) => {
        lastBannerHeight = e.nativeEvent.layout.height;
        bannerHeightListeners.forEach((f) => f(lastBannerHeight));
      }}
    >
      <View {...swipeResponder.panHandlers}>
        <View style={[styles.noticeLine, lineThin && { height: 1 }]} />
        <MarqueeNotice text={t("player.notice")} />
      </View>
      <View style={styles.noticeLine} />
      <LinearGradient
        colors={["#000", "#000"]}
        style={styles.bar}
      >
        <View style={styles.side}>
          <Text style={styles.sideText}>_relapse_radio</Text>
        </View>

        <View style={styles.transport}>
          <Pressable style={styles.btn} onPress={prev}>
            <Text style={styles.btnTxt}>{"<<"}</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={toggle}>
            <Text style={styles.btnTxt}>{st.playing ? "||" : ">"}</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={next}>
            <Text style={styles.btnTxt}>{">>"}</Text>
          </Pressable>
        </View>

        <View style={[styles.side, styles.sideRight]}>
          <Text style={styles.sideText}>{Math.round(st.volume * 100)}%</Text>
          <VolumeSlider live={st.volume} />
        </View>
      </LinearGradient>
      <View style={{ height: insets.bottom, backgroundColor: "#000" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  noticeLine: { height: 2, backgroundColor: "#ff2bd6", marginTop: 0, marginBottom: 0 },
  marqueeContainer: {
    overflow: "hidden",
    width: "100%",
    height: 14,
    justifyContent: "center",
    backgroundColor: "#000",
  },
  noticeText: {
    color: "#9a9a9a",
    fontSize: 12,
    fontWeight: "bold",
    fontStyle: "italic",
    letterSpacing: 0.2,
    backgroundColor: "#000",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 14,
  },
  side: { flex: 1, flexDirection: "row", alignItems: "center" },
  sideRight: { justifyContent: "flex-end", gap: 8 },
  sideText: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  transport: { flexDirection: "row", gap: 14, alignItems: "center" },
  btn: { padding: 4 },
  btnTxt: { color: "#fff", fontWeight: "bold", fontStyle: "italic", fontSize: 20 },
  track: { width: TRACK_WIDTH, height: 20, justifyContent: "center" },
  trackFill: {
    position: "absolute",
    left: 0,
    height: 3,
    backgroundColor: "#ff2bd6",
    borderRadius: 2,
  },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ff2bd6",
  },
});
