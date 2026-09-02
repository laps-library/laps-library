import { useLang } from "../lib/i18n";
import { useEffect, useMemo, useRef } from "react";
import { Dimensions, Pressable, StyleSheet, View, Text, ScrollView } from "react-native";
import { router, usePathname } from "expo-router";
const ROSE = "#ff2bd6";

const PAGES = [
  { key: "/home", labelKey: "nav.home" },
  { key: "/catalog", labelKey: "nav.catalog" },
  { key: "/reserve", labelKey: "nav.reserve" },
  { key: "/profile", labelKey: "nav.profile" },
  { key: "/news", labelKey: "nav.news" },
  { key: "/forum", labelKey: "nav.forum" },
];

function currentRoot(pathname: string): string {
  const seg = (pathname || "").split("/").filter(Boolean)[0];
  if (!seg) return "/home";
  if (seg === "instrument") return "/catalog";
  return "/" + seg;
}

export default function AppMenu() {
  const pathname = usePathname();
  const current = currentRoot(pathname);
  const { t } = useLang();

  const SCREEN_W = Dimensions.get("window").width;
  const CARD_W = Math.round(SCREEN_W / 3);
  const SNAP = CARD_W;
  const SIDE_PAD = Math.round((SCREEN_W - CARD_W) / 2);

  const scrollRef = useRef<ScrollView>(null);
  const initialized = useRef(false);
  const lastScrolledIndex = useRef(-1);

  const items = useMemo(() => PAGES.map((p) => ({ key: p.key, label: t(p.labelKey) })), [t]);

  const n = items.length;
  const currentRealIndex = items.findIndex((it) => it.key === current);
  const activeIndex = currentRealIndex >= 0 ? currentRealIndex : 0;

  // Position initiale sur l'item actif
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: activeIndex * SNAP, animated: false });
      lastScrolledIndex.current = activeIndex;
    }, 50);
    return () => clearTimeout(t);
  }, [activeIndex, SNAP]);

  // Re-centrage quand la page change (navigation externe)
  useEffect(() => {
    if (!initialized.current) return;
    if (lastScrolledIndex.current === activeIndex) return;
    lastScrolledIndex.current = activeIndex;
    scrollRef.current?.scrollTo({ x: activeIndex * SNAP, animated: true });
  }, [activeIndex, SNAP]);

  function triggerPlay() {
    console.log("🎮 triggerPlay, page actuelle :", current);
    if (current !== "/home") {
      lastScrolledIndex.current = 0;
      router.push("/home" as any);
      setTimeout(() => emitMenuEvent("toggleBallMode"), 400);
    } else {
      triggerPlay();
    }
  }

  // Fin de scroll : détecter l'item centré et agir
  function handleMomentumEnd(e: any) {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SNAP);
    const realIdx = Math.max(0, Math.min(n - 1, idx));

    const item = items[realIdx];
    if (!item) return;

    // Ignore les fins de défilement issues d'un recentrage programmatique
    if (realIdx === lastScrolledIndex.current) return;

    if (item.key !== current) {
      lastScrolledIndex.current = realIdx;
      router.push(item.key as any);
    }
  }

  // Clic : centrer l'item puis agir
  function handlePress(realIdx: number) {
    const item = items[realIdx];
    if (!item) return;

    scrollRef.current?.scrollTo({ x: realIdx * SNAP, animated: true });

    if (item.key !== current) {
      lastScrolledIndex.current = realIdx;
      router.push(item.key as any);
    }
  }

  return (
    <View style={styles.frame}>
      {/* Triangle indicateur au-dessus de l'item centré */}
      <View style={styles.indicatorRow} pointerEvents="none">
        <View style={styles.triangle} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
        onMomentumScrollEnd={handleMomentumEnd}
        style={{ flex: 1 }}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              key={item.key + "-" + index}
              onPress={() => handlePress(index)}
              style={[styles.block, { width: CARD_W }]}
            >
              <Text
                style={[styles.label, isActive && styles.labelActive]}
                numberOfLines={1}
              >
                {"_" + item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  indicatorRow: {
    position: "absolute",
    top: 2,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: ROSE,
  },
  block: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    color: "#ffffff",
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  labelActive: {
    color: ROSE,
  },
});
