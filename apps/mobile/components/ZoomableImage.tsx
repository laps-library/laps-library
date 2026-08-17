import { useRef, useState } from 'react';
import { Dimensions, Image, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;

export default function ZoomableImage({ source, visible, onClose }: { source: any; visible: boolean; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const base = useRef({ scale: 1, x: 0, y: 0, d: 0 });
  const lastTap = useRef(0);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const responder = PanResponder.create({
    onMoveShouldBePanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const t = evt.nativeEvent.touches;
      base.current = { scale, x: pos.x, y: pos.y, d: t.length === 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0 };
    },
    onPanResponderMove: (evt, gestureState) => {
      const t = evt.nativeEvent.touches;
      if (t.length === 2 && base.current.d > 0) {
        const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        setScale(clamp(base.current.scale * (d / base.current.d), 1, 5));
      } else if (scale > 1) {
        setPos({ x: base.current.x + gestureState.dx, y: base.current.y + gestureState.dy });
      }
    },
    onPanResponderRelease: () => {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        const z = scale > 1 ? 1 : 2.5;
        setScale(z);
        setPos({ x: 0, y: 0 });
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
      if (scale <= 1) setPos({ x: 0, y: 0 });
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>
        <View style={styles.zone} {...responder.panHandlers}>
          <Image
            source={source}
            style={{ width: W * 0.92, height: H * 0.7, transform: [{ scale }, { translateX: pos.x }, { translateY: pos.y }] }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.hint}>_Pince pour zoomer · double-tap pour basculer · ✕ pour fermer</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  zone: { width: W, height: H * 0.8, justifyContent: 'center', alignItems: 'center' },
  close: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: '#000', borderWidth: 1, borderColor: '#FF2BD6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  closeTxt: { color: '#FF2BD6', fontSize: 16, fontWeight: 'bold' },
  hint: { position: 'absolute', bottom: 30, color: '#8e8e93', fontStyle: 'italic', fontSize: 12 },
});
