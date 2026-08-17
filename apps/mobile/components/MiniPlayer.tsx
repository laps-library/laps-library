import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
const TRACKS = [
  require('../assets/audio/track01.mp3'),
  require('../assets/audio/track02.mp3'),
  require('../assets/audio/track03.mp3'),
  require('../assets/audio/track04.mp3'),
  require('../assets/audio/track05.mp3'),
  require('../assets/audio/track06.mp3'),
  require('../assets/audio/track07.mp3'),
  require('../assets/audio/track08.mp3'),
  require('../assets/audio/track09.mp3'),
  require('../assets/audio/track10.mp3'),
];

function randomIndex(except: number) {
  if (TRACKS.length <= 1) return 0;
  let r = Math.floor(Math.random() * TRACKS.length);
  while (r === except) r = Math.floor(Math.random() * TRACKS.length);
  return r;
}

// ===== AUDIO SINGLETON : un seul son pour toute l'app =====
let sound: Audio.Sound | null = null;
let isPlaying = false;
let currentIndex = 0;
let volume = 0.3;
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
  try { s.setOnPlaybackStatusUpdate(null); } catch (e) {}
  try { await s.unloadAsync(); } catch (e) {}
}

async function playAt(i: number, recordHistory = true) {
  if (busy) return;
  busy = true;
  try {
    if (recordHistory && sound) history.push(currentIndex);
    await stopSound();
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound: s } = await Audio.Sound.createAsync(TRACKS[i], { volume });
    sound = s;
    currentIndex = i;
    s.setOnPlaybackStatusUpdate((status: any) => {
      if (status.isLoaded && sound === s) {
        isPlaying = status.isPlaying;
        emit();
        if (status.didJustFinish) playAt(randomIndex(i), false);
      }
    });
    await s.playAsync();
    isPlaying = true;
    emit();
  } catch (e) {} finally {
    busy = false;
  }
}

async function toggle() {
  if (!sound) { await playAt(randomIndex(currentIndex), false); return; }
  if (isPlaying) { await sound.pauseAsync(); isPlaying = false; emit(); }
  else { await sound.playAsync(); isPlaying = true; emit(); }
}

function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (sound) sound.setVolumeAsync(volume).catch(() => {});
  emit();
}

function next() { playAt(randomIndex(currentIndex)); }
function prev() {
  const last = history.pop();
  playAt(last != null ? last : randomIndex(currentIndex), false);
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
    })
  ).current;

  return (
    <View style={styles.track} {...responder.panHandlers}>
      <View style={[styles.trackFill, { width: live * TRACK_WIDTH }]} />
      <View style={[styles.thumb, { left: live * TRACK_WIDTH - 7 }]} />
    </View>
  );
}

export default function MiniPlayer() {
  const insets = useSafeAreaInsets();
  const [st, setSt] = useState({ playing: isPlaying, index: currentIndex, volume });

  useEffect(() => {
    const l = (s: any) => setSt(s);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  return (
    <View style={{ backgroundColor: '#000' }}>
      <LinearGradient colors={['#000', '#fff', '#000']} locations={[0, 0.5, 1]} style={styles.bar}>
        <View style={styles.side}>
          <Text style={styles.sideText}>_relapse_radio</Text>
        </View>

        <View style={styles.transport}>
          <Pressable style={styles.btn} onPress={prev}><Text style={styles.btnTxt}>{'<<'}</Text></Pressable>
          <Pressable style={styles.btn} onPress={toggle}><Text style={styles.btnTxt}>{st.playing ? '||' : '>'}</Text></Pressable>
          <Pressable style={styles.btn} onPress={next}><Text style={styles.btnTxt}>{'>>'}</Text></Pressable>
        </View>

        <View style={[styles.side, styles.sideRight]}>
          <Text style={styles.sideText}>{Math.round(st.volume * 100)}%</Text>
          <VolumeSlider live={st.volume} />
        </View>
      </LinearGradient>
      <View style={{ height: insets.bottom, backgroundColor: '#000' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 8, paddingHorizontal: 14 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end', gap: 8 },
  sideText: { color: '#000', fontWeight: 'bold', fontStyle: 'italic', fontSize: 12, letterSpacing: 0.5 },
  transport: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  btn: { padding: 4 },
  btnTxt: { color: '#000', fontWeight: 'bold', fontStyle: 'italic', fontSize: 20 },
  track: { width: TRACK_WIDTH, height: 20, justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, height: 3, backgroundColor: '#000', borderRadius: 2 },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#000' },
});
