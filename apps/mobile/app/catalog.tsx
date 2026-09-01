import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView as GHScrollView } from "react-native-gesture-handler";
import { LOCAL_PHOTOS } from "../assets/instruments/manifest";

const AnimatedGHScrollView = Animated.createAnimatedComponent(GHScrollView) as any;
import BackButton from "../components/BackButton";
import { supabase } from "../lib/supabase";
import { photoSource, stationPhotoSource, isAccessory } from "../lib/instrumentUtils";

const SCREEN_W = Dimensions.get("window").width;
const CARD_W = Math.round(Math.min(SCREEN_W * 0.66, 300));
const CARD_H = 420;
const CARD_MARGIN = 18;
const SNAP = CARD_W + CARD_MARGIN;
const SIDE_PAD = (SCREEN_W - CARD_W) / 2;

type Row = {
  id: string;
  name: string;
  brand: string;
  category: string;
  borrowable: boolean;
  year: number | null;
  synthesis_type: string | null;
  photo_url: string | null;
  ease_of_use: number | null;
  acquired: boolean;
  access_type: string | null;
  kind: string;
  package: string[] | null;
  units: number | null;
  sort_order: number | null;
  description: string | null;
};

const TABS = [
  { key: "empruntable", label: "EMPRUNTABLE" },
  { key: "premium", label: "PREMIUM" },
  { key: "libre_service", label: "LIBRE SERVICE" },
];

const TYPES = [
  "Synthé modulaire",
  "Synthé polyphonique",
  "Synthé monophonique",
  "Drum Machine",
  "Sampler",
  "Groovebox",
  "Effet",
  "Matériel",
];

/*
 * Carrousel "manège" : liste triplée pour permettre un défilement infini,
 * avec un saut invisible (sans animation) quand on approche des bords.
 */
function ScrollIndicator({ scrollRef }: { scrollRef: React.RefObject<any> }) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  return (
    <View style={styles.scrollHintWrap}>
      <LinearGradient
        colors={["transparent", "#000"]}
        style={styles.scrollHintFade}
        pointerEvents="none"
      />
      <Animated.Text style={[styles.scrollHintChevron, { transform: [{ translateY }] }]}>
        ↓
      </Animated.Text>
      <Text style={styles.scrollHintText}>Faire défiler</Text>
    </View>
  );
}

function InfiniteCoverflow({
  items,
  renderCard,
  verticalScrollRef,
  innerRef,
}: {
  items: Row[];
  renderCard: (item: Row, shouldLoadImage: boolean) => React.ReactNode;
  verticalScrollRef: React.RefObject<any>;
  innerRef?: React.MutableRefObject<any>;
}) {
  const localRef = useRef<any>(null);
  const scrollRef = innerRef ?? localRef;
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

  function handleMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
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
    <AnimatedGHScrollView
      ref={scrollRef}
      horizontal
      simultaneousHandlers={verticalScrollRef}
      activeOffsetX={[-10, 10]}
      failOffsetY={[-10, 10]}
      showsHorizontalScrollIndicator={false}
      snapToInterval={SNAP}
      decelerationRate="fast"
      snapToAlignment="start"
      bounces={false}
      contentContainerStyle={{ paddingHorizontal: SIDE_PAD }}
      contentOffset={{ x: baseOffset, y: 0 }}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      })}
      onMomentumScrollEnd={handleMomentumEnd}
    >
      {loopedItems.map((item, index) => {
        const inputRange = [(index - 1) * SNAP, index * SNAP, (index + 1) * SNAP];

        const rotateY = scrollX.interpolate({
          inputRange,
          outputRange: ["24deg", "0deg", "-24deg"],
          extrapolate: "clamp",
        });

        const scale = scrollX.interpolate({
          inputRange,
          outputRange: [0.92, 1, 0.92],
          extrapolate: "clamp",
        });

        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.75, 1, 0.75],
          extrapolate: "clamp",
        });

        const translateX = scrollX.interpolate({
          inputRange,
          outputRange: [22, 0, -22],
          extrapolate: "clamp",
        });

        return (
          <Animated.View
            key={`${item.id}-${index}`}
            style={[
              styles.carouselCardWrap,
              {
                marginRight: CARD_MARGIN,
                opacity,
                transform: [{ perspective: 900 }, { translateX }, { scale }, { rotateY }],
              },
            ]}
          >
            {renderCard(item, Math.abs(index - centerIndex) <= 2)}
          </Animated.View>
        );
      })}
    </AnimatedGHScrollView>
  );
}

export default function CatalogScreen() {
  const verticalScrollRef = useRef<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState("empruntable");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [typeOpen, setTypeOpen] = useState(false);
  const [showComing, setShowComing] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("instrument_models")
        .select(
          "id, name, brand, category, borrowable, year, synthesis_type, photo_url, ease_of_use, acquired, access_type, kind, package, units, sort_order, description",
        )
        .in("kind", ["instrument", "premium_station"])
        .order("brand")
        .order("name");

      if (error) {
        // Erreur de chargement du catalogue (silent)
        return;
      }

      setRows((data as Row[]) ?? []);
    }

    load();
  }, []);

  useEffect(() => {
    setShowComing(false);
    setTypeFilter("all");
  }, [tab]);

  const stations = rows
    .filter((r) => r.kind === "premium_station" && !r.name.toLowerCase().includes("keystage"))
    .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));

  const instruments = rows.filter(
    (r) => r.kind === "instrument" && !r.name.toLowerCase().includes("keystage"),
  );

  const currentInstruments = instruments.filter((i) => {
    if (!i.acquired) return false;
    if (tab === "empruntable") {
      return i.borrowable || (i.access_type ?? "").toLowerCase() === "empruntable";
    }
    return tab === "libre_service" && (i.access_type ?? "libre_service") === "libre_service";
  });

  const comingInstruments = instruments.filter((i) => {
    if (i.acquired) return false;
    if (tab === "empruntable") {
      return i.borrowable || (i.access_type ?? "").toLowerCase() === "empruntable";
    }
    return tab === "libre_service" && (i.access_type ?? "libre_service") === "libre_service";
  });

  const currentStations = stations.filter((s) => s.acquired);
  const comingStations = stations.filter((s) => !s.acquired);

  const filteredCurrentInstruments = currentInstruments.filter((i) =>
    typeFilter === "all" ? true : i.category === typeFilter,
  );

  const filteredComingInstruments = comingInstruments.filter((i) =>
    typeFilter === "all" ? true : i.category === typeFilter,
  );

  function renderStationCardContent(s: Row, shouldLoadImage: boolean) {
    const packageLines = s.package ?? [];

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/instrument/${s.id}`)}
        style={styles.stationCardTouchable}
      >
        <Text style={styles.stationName}>{s.name.replace("Poste Premium — ", "")}</Text>

        {stationPhotoSource(s) && shouldLoadImage ? (
          <View style={styles.carouselPhotoBox}>
            <ExpoImage
              source={stationPhotoSource(s)}
              style={styles.carouselPhoto}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          </View>
        ) : (
          <View style={[styles.carouselPhotoBox, styles.photoEmpty]}>
            <Text style={styles.photoLetter}>{s.brand?.[0]}</Text>
          </View>
        )}

        <View style={styles.stationPackageBlock}>
          {packageLines.map((p, idx) => (
            <Text
              key={idx}
              style={[styles.stationPackageLine, !isAccessory(p) && styles.stationPackageLineBold]}
            >
              _ {p}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    );
  }

  function renderInstrumentCardContent(item: Row, shouldLoadImage: boolean) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => router.push(`/instrument/${item.id}`)}
        style={styles.stationCardTouchable}
      >
        <Text style={styles.stationName}>{item.name}</Text>

        {photoSource(item) && shouldLoadImage ? (
          <View style={styles.carouselPhotoBox}>
            <ExpoImage
              source={photoSource(item)}
              style={styles.carouselPhoto}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          </View>
        ) : (
          <View style={[styles.carouselPhotoBox, styles.photoEmpty]}>
            <Text style={styles.photoLetter}>{item.brand?.[0]}</Text>
          </View>
        )}

        <Text style={styles.instrumentBrand}>
          {item.brand}
          {item.year ? ` · ${item.year}` : ""}
        </Text>
        {item.synthesis_type ? (
          <Text style={styles.instrumentMeta}>{item.synthesis_type}</Text>
        ) : null}
        {item.description ? <Text style={styles.instrumentDesc}>{item.description}</Text> : null}
        {item.ease_of_use != null ? (
          <Text style={styles.instrumentMeta}>_Facilité d'utilisation : {item.ease_of_use}/5</Text>
        ) : null}

        <View style={styles.badges}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(item.borrowable || (item.access_type ?? "").toLowerCase() === "empruntable") && (
              <Text style={styles.badge}>Empruntable</Text>
            )}
            <Text style={styles.badge}>Sur place</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.title}>_Catalogue</Text>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.tabText, tab === t.key && styles.tabTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab !== "premium" && (
        <View style={styles.filterModule}>
          <Text style={styles.filterLabel}>_Filtrer les instruments</Text>

          <TouchableOpacity
            style={[styles.typeButton, typeFilter !== "all" && styles.typeButtonActive]}
            onPress={() => setTypeOpen(true)}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.typeButtonText, typeFilter !== "all" && styles.typeButtonTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {typeFilter === "all" ? "Tous les types" : typeFilter}
            </Text>
            <Text style={[styles.typeArrow, typeFilter !== "all" && styles.typeButtonTextActive]}>
              ▾
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        transparent
        visible={typeOpen}
        animationType="fade"
        onRequestClose={() => setTypeOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setTypeOpen(false)}
        >
          <View style={styles.modalBox}>
            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                setTypeFilter("all");
                setTypeOpen(false);
              }}
            >
              <Text style={[styles.optionText, typeFilter === "all" && styles.optionTextActive]}>
                Tous les types
              </Text>
            </TouchableOpacity>

            {TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.option}
                onPress={() => {
                  setTypeFilter(t);
                  setTypeOpen(false);
                }}
              >
                <Text style={[styles.optionText, typeFilter === t && styles.optionTextActive]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <GHScrollView
        ref={verticalScrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {tab === "premium" && (
          <>
            <View style={styles.section}>
              {currentStations.length > 0 ? (
                <View>
                  <InfiniteCoverflow
                    items={currentStations}
                    renderCard={renderStationCardContent}
                    verticalScrollRef={verticalScrollRef}
                  />
                  <ScrollIndicator scrollRef={null as any} />
                </View>
              ) : (
                <Text style={styles.empty}>Aucun poste premium disponible.</Text>
              )}
            </View>

            {comingStations.length > 0 && (
              <>
                {!showComing && (
                  <TouchableOpacity
                    style={styles.comingButton}
                    onPress={() => setShowComing(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.comingButtonText}>À VENIR</Text>
                  </TouchableOpacity>
                )}

                {showComing && (
                  <View style={styles.comingSection}>
                    <Text style={styles.comingTitle}>_À venir</Text>
                    <InfiniteCoverflow
                      items={comingStations}
                      renderCard={renderStationCardContent}
                      verticalScrollRef={verticalScrollRef}
                    />
                    <ScrollIndicator scrollRef={null as any} />

                    <TouchableOpacity
                      style={styles.comingButton}
                      onPress={() => setShowComing(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.comingButtonText}>MASQUER</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {(tab === "libre_service" || tab === "empruntable") && (
          <>
            <View style={styles.section}>
              {filteredCurrentInstruments.length > 0 ? (
                <View>
                  <InfiniteCoverflow
                    items={filteredCurrentInstruments}
                    renderCard={renderInstrumentCardContent}
                    verticalScrollRef={verticalScrollRef}
                  />
                  <ScrollIndicator scrollRef={null as any} />
                </View>
              ) : (
                <Text style={styles.empty}>Aucun instrument dans cette catégorie.</Text>
              )}
            </View>

            {filteredComingInstruments.length > 0 && (
              <>
                {!showComing && (
                  <TouchableOpacity
                    style={styles.comingButton}
                    onPress={() => setShowComing(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.comingButtonText}>À VENIR</Text>
                  </TouchableOpacity>
                )}

                {showComing && (
                  <View style={styles.comingSection}>
                    <Text style={styles.comingTitle}>_À venir</Text>
                    <InfiniteCoverflow
                      items={filteredComingInstruments}
                      renderCard={renderInstrumentCardContent}
                      verticalScrollRef={verticalScrollRef}
                    />
                    <ScrollIndicator scrollRef={null as any} />

                    <TouchableOpacity
                      style={styles.comingButton}
                      onPress={() => setShowComing(false)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.comingButtonText}>MASQUER</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </GHScrollView>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  header: { backgroundColor: "#000", paddingTop: 4, paddingBottom: 14, zIndex: 10 },

  title: {
    textAlign: "center",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 26,
    color: "#fff",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 18,
    letterSpacing: 1,
  },

  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 16 },

  tab: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 10,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  tabActive: { backgroundColor: "#fff", borderColor: "#fff" },

  tabText: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 11,
    letterSpacing: 0.8,
    textAlign: "center",
    includeFontPadding: true,
    lineHeight: 18,
  },

  tabTextActive: { color: "#000" },

  filterModule: { marginHorizontal: 24, marginTop: 8, marginBottom: 4, paddingBottom: 4 },

  filterLabel: {
    color: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    marginBottom: 6,
  },

  typeButton: {
    height: 42,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    backgroundColor: "#000",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  typeButtonActive: { borderColor: "#ff2bd6" },

  typeButtonText: {
    flex: 1,
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.8,
  },

  typeButtonTextActive: { color: "#ff2bd6" },

  typeArrow: { color: "#fff", fontSize: 16, marginLeft: 10 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },

  modalBox: {
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 12,
    padding: 8,
  },

  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },

  optionText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  optionTextActive: { color: "#ff2bd6" },

  scroll: { flexGrow: 1, paddingTop: 10, paddingBottom: 50, gap: 14 },

  section: { marginBottom: 6 },

  comingSection: { marginTop: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#333" },

  comingTitle: {
    color: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 24,
  },

  /*
   * CARROUSEL — effet coverflow, taille agrandie
   */
  carouselCardWrap: { width: CARD_W },

  stationCardTouchable: {
    width: CARD_W,
    height: CARD_H,
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    backgroundColor: "#000",
  },

  carouselPhotoBox: {
    width: CARD_W - 36,
    height: CARD_W - 70,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },

  carouselPhoto: { width: "100%", height: "100%" },

  stationPackageBlock: { width: "100%", alignItems: "center" },

  stationName: {
    fontSize: 17,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
    letterSpacing: 0.8,
    textAlign: "center",
  },

  stationPackageLine: {
    color: "#fff",
    fontSize: 11.5,
    fontStyle: "italic",
    lineHeight: 17,
    marginBottom: 1,
    textAlign: "center",
  },

  stationPackageLineBold: { fontWeight: "bold" },

  instrumentBrand: {
    color: "#ff2bd6",
    fontSize: 13,
    fontStyle: "italic",
    marginTop: 4,
    textAlign: "center",
  },

  instrumentMeta: { color: "#fff", fontSize: 12, textAlign: "center", marginTop: 2 },

  instrumentDesc: {
    color: "#8e8e93",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 14,
  },

  photoEmpty: { backgroundColor: "#000", borderWidth: 1, borderColor: "#fff" },

  photoLetter: { color: "#fff", fontSize: 24, fontWeight: "bold", fontStyle: "italic" },

  badges: { flexDirection: "row", gap: 8, marginTop: 8 },

  badge: {
    color: "#000",
    backgroundColor: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },

  comingButton: {
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 10,
    minWidth: 120,
    height: 42,
    paddingHorizontal: 22,
    marginTop: 14,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  comingButtonText: {
    color: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 1.2,
    lineHeight: 18,
    textAlign: "center",
  },

  scrollHintWrap: { height: 50, alignItems: "center", marginTop: 14, position: "relative" },
  scrollHintFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -30,
    height: 40,
  },
  scrollHintChevron: { color: "#ff2bd6", fontSize: 22, fontWeight: "bold", lineHeight: 24 },
  scrollHintText: {
    color: "#8e8e93",
    fontSize: 10,
    fontStyle: "italic",
    letterSpacing: 1,
    marginTop: 2,
  },

  empty: {
    color: "#8e8e93",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 10,
  },
});
