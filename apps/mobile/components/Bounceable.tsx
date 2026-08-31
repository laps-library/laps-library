import { useEffect, useRef } from "react";
import { View } from "react-native";
import { registerObstacle, unregisterObstacle } from "./BounceOverlay";

export default function Bounceable({ children, style, inset = 0 }: any) {
  const ref = useRef<View>(null);
  const idRef = useRef(Math.random().toString(36).slice(2));

  function measure() {
    ref.current?.measureInWindow((x, y, w, h) => {
      if (inset > 0) {
        const dx = w * inset;
        const dy = h * inset;
        x += dx;
        y += dy;
        w -= 2 * dx;
        h -= 2 * dy;
      }
      if (w > 0 && h > 0) registerObstacle(idRef.current, { x, y, w, h });
    });
  }

  useEffect(() => {
    const timers = [300, 1000, 2000, 4000].map((t) => setTimeout(measure, t));
    return () => {
      timers.forEach(clearTimeout);
      unregisterObstacle(idRef.current);
    };
  }, []);

  return (
    <View ref={ref} style={style} onLayout={() => setTimeout(measure, 50)}>
      {children}
    </View>
  );
}
