import { useLang } from "../../lib/i18n";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import YoutubePlayer from "../../components/YoutubePlayer";
import { LOCAL_FULL_PHOTOS } from "../../assets/instruments/manifest-full";
import AppButton from "../../components/AppButton";
import BackButton from "../../components/BackButton";
import { supabase } from "../../lib/supabase";
import { fullPhotoSource as photoSource, ytId } from "../../lib/instrumentUtils";
import ZoomableImage from "../../components/ZoomableImage";

const H = Dimensions.get("window").height;
const W = Dimensions.get("window").width;

export default function InstrumentDetailScreen() {
  const { t, lang } = useLang();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [activeLoans, setActiveLoans] = useState(0);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [zoom, setZoom] = useState(false);
  const [packageInstruments, setPackageInstruments] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("instrument_models").select("*").eq("id", id).single();

      setItem(data);

      const { data: sess } = await supabase.auth.getSession();

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", sess.session?.user.id)
        .single();

      setProfile(p);

      if (p?.plan_id) {
        const { data: pl } = await supabase.from("plans").select("*").eq("id", p.plan_id).single();

        setPlan(pl);
      }

      // Compter uniquement les prêts actifs (pas les futurs/réservés)
      const { count } = await supabase
        .from("loans")
        .select("*", { count: "exact", head: true })
        .eq("user_id", sess.session?.user.id)
        .eq("status", "active");

      setActiveLoans(count ?? 0);

      // Charger les vidéos et manuels des instruments du package (pour les postes premium)
      if (data?.package && Array.isArray(data.package) && data.package.length > 0) {
        const { data: pkgInstruments } = await supabase
          .from("instrument_models")
          .select("name, videos, manual_url")
          .in("name", data.package);
        setPackageInstruments(pkgInstruments ?? []);
      } else {
        setPackageInstruments([]);
      }
    }

    load();
  }, [id]);

  // Calculer les 4 prochaines semaines disponibles
  useEffect(() => {
    const weeks: string[] = [];
    const today = new Date();

    // Commencer à partir de la semaine prochaine
    for (let i = 1; i <= 16; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + i * 7);
      // Arrondir au lundi
      const day = weekStart.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + diff);

      weeks.push(weekStart.toISOString().split("T")[0]);
    }

    setAvailableWeeks(weeks);
    if (weeks.length > 0) {
      setSelectedWeek(weeks[0]);
    }
  }, []);

  async function pickDocument() {
    if (!profile) return;
    const res = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const file = res.assets[0];
    setUploading(true);
    try {
      const resp = await fetch(file.uri);
      const blob = await resp.blob();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${profile.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("id-documents")
        .upload(path, blob, { upsert: true });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({
          id_document_url: path,
          id_document_status: "pending",
          id_uploaded_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (dbErr) {
        Alert.alert("Erreur DB", dbErr.message);
        return;
      }
      Alert.alert("Envoyé", "Votre pièce d'identité sera vérifiée par un administrateur.");
      setProfile({ ...profile, id_document_status: "pending" });
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de l'envoi.");
    } finally {
      setUploading(false);
    }
  }

  function requestLoan() {
    // Rediriger vers la page de réservation centralisée (choix de semaine là-bas)
    router.push({
      pathname: "/reserve",
      params: {
        instrument_id: id,
        type: "emprunt",
      },
    });
  }

  if (!item) return null;

  const fullPhoto = photoSource(item);
  const photoDims = fullPhoto ? Image.resolveAssetSource(fullPhoto) : null;
  const photoH = photoDims ? Math.min(H * 0.7, W * (photoDims.height / photoDims.width)) : H * 0.6;
  const photoW = photoDims ? Math.min(W, photoH * (photoDims.width / photoDims.height)) : W;

  const canRequest = item.borrowable && item.acquired && plan?.can_borrow;

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />

      <View style={styles.stickyHeader}>
        <Text style={styles.brandTitle}>{item.brand}</Text>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {(item.name || "").replace("Poste Premium — ", "")}
          </Text>
          <Text style={styles.yearInline}>{item.year ?? "—"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {fullPhoto ? (
          <View style={styles.photoWrap}>
            <TouchableOpacity onPress={() => setZoom(true)} activeOpacity={0.9}>
              <Image
                source={fullPhoto}
                style={{ width: photoW, height: photoH }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.photoEmpty, { height: photoH }]}>
            <Text style={styles.photoLetter}>{item.brand?.[0] ?? "_"}</Text>
          </View>
        )}

        <ZoomableImage source={fullPhoto} visible={zoom} onClose={() => setZoom(false)} />

        <Text style={styles.meta}>
          {item.category}
          {item.synthesis_type ? ` · ${lang === "en" && item.synthesis_type_en ? item.synthesis_type_en : item.synthesis_type}` : ""}
        </Text>

        <Text style={styles.meta}>Facilité {item.ease_of_use ?? "-"}/5</Text>

        {item.description ? <Text style={styles.desc}>{lang === "en" && item.description_en ? item.description_en : item.description}</Text> : null}

        <View style={styles.badges}>
          <Text style={styles.badge}>{item.acquired ? "Acquis" : "À venir"}</Text>

          <Text style={styles.badge}>{item.borrowable ? t("msg.lendable") : t("msg.onsite")}</Text>

          {item.units > 1 ? <Text style={styles.badge}>×{item.units} unités</Text> : null}
        </View>

        {item.package && item.package.length > 0 && (
          <Text style={styles.label}>{t("ttl.included_station")}</Text>
        )}

        {(item.package ?? []).map((pkg: string, idx: number) => (
          <Text key={idx} style={styles.packageItem}>
            _ {pkg}
          </Text>
        ))}

        {item.manual_url && (
          <AppButton
            label={t("lbl.user_manual")}
            onPress={() => Linking.openURL(item.manual_url)}
          />
        )}

        {/* === MANUELS DES INSTRUMENTS DU PACKAGE === */}
        {packageInstruments
          .filter((pkg) => pkg.manual_url)
          .map((pkg, idx) => (
            <AppButton
              key={`pkg-manual-${idx}`}
              label={`Manuel — ${pkg.name}`}
              onPress={() => Linking.openURL(pkg.manual_url)}
            />
          ))}

        {item.videos && item.videos.length > 0 && <Text style={styles.label}>{t("ttl.tutorials")}</Text>}

        {(item.videos ?? []).map((v: any, idx: number) => {
          // Mapping des chaînes YouTube connues
          const channelLabels: Record<string, string> = {
            loopop: "_Loopop",
            sonicstate: "_Sonic State",
            boombaptv: "_BoomBap TV",
            gearslutz: "_Gearslutz",
            sweetwater: "_Sweetwater",
            "music-is-wine": "_Music Is Wine",
            "the-sound-test-room": "_The Sound Test Room",
            "pro-audio-reviews": "_Pro Audio Reviews",
            audiofanzine: "_Audiofanzine",
            "jeff-friedman": "_Jeff Friedman",
            "synth-junkie": "_Synth Junkie",
            cuckoo: "_Cuckoo",
            kijimi: "_Kijimi",
            automaticgainsay: "_AutomaticGainsay",
            dubby: "_Dubby",
            gloop: "_Gloop",
            synthesis: "_Synthesis",
          };

          const channelLabel = channelLabels[v.channel?.toLowerCase()] || "_Vidéo";

          return (
            <View key={idx} style={styles.videoWrap}>
              {v.title && <Text style={styles.videoTitle}>{v.title}</Text>}

              <YoutubePlayer height={220} videoId={ytId(v.id)} play={false} />
            </View>
          );
        })}

        {/* === VIDÉOS DES INSTRUMENTS DU PACKAGE === */}
        {packageInstruments
          .filter((pkg) => pkg.videos && pkg.videos.length > 0)
          .map((pkg, pkgIdx) => (
            <View key={`pkg-videos-${pkgIdx}`}>
              <Text style={[styles.label, { marginTop: 16 }]}>_{pkg.name} — Tutoriels</Text>
              {(pkg.videos ?? []).map((v: any, vIdx: number) => {
                const channelLabels: Record<string, string> = {
                  loopop: "_Loopop",
                  sonicstate: "_Sonic State",
                  boombaptv: "_BoomBap TV",
                  gearslutz: "_Gearslutz",
                  sweetwater: "_Sweetwater",
                  "music-is-wine": "_Music Is Wine",
                  "the-sound-test-room": "_The Sound Test Room",
                  "pro-audio-reviews": "_Pro Audio Reviews",
                  audiofanzine: "_Audiofanzine",
                  "jeff-friedman": "_Jeff Friedman",
                  "synth-junkie": "_Synth Junkie",
                  cuckoo: "_Cuckoo",
                  kijimi: "_Kijimi",
                  automaticgainsay: "_AutomaticGainsay",
                  dubby: "_Dubby",
                  gloop: "_Gloop",
                  synthesis: "_Synthesis",
                };

                const channelLabel = channelLabels[v.channel?.toLowerCase()] || "_Vidéo";

                return (
                  <View key={vIdx} style={styles.videoWrap}>
                    {v.title && <Text style={styles.videoTitle}>{v.title}</Text>}

                    <YoutubePlayer height={220} videoId={ytId(v.id)} play={false} />
                  </View>
                );
              })}
            </View>
          ))}

        {/* === SECTION EMPRUNT / RÉSERVATION UNIFIÉE === */}
        {item.borrowable && item.acquired && (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>{t("ttl.loan")}</Text>

            {plan?.can_borrow ? (
              <>
                {/* Tarifs selon le plan */}
                <View style={styles.actionInfo}>
                  <Text style={styles.actionInfoLabel}>{t("msg.loan_rate")}</Text>
                  <Text style={styles.actionInfoValue}>
                    {/nerd/i.test(plan.name || "")
                      ? "10 € / 1 semaine · 15 € / 2 semaines"
                      : "10 € / 1 semaine"}
                  </Text>
                </View>

                {/* Pièce d'identité requise */}
                {profile?.id_document_status !== "verified" && (
                  <View style={styles.actionInfo}>
                    <Text style={styles.actionInfoLabel}>{t("msg.id_document")}</Text>
                    <Text style={styles.actionInfoValue}>
                      {profile?.id_document_status === "pending"
                        ? "En cours de vérification"
                        : "Requise pour emprunter"}
                    </Text>
                    {profile?.id_document_status !== "pending" && (
                      <TouchableOpacity
                        onPress={pickDocument}
                        style={[styles.actionButton, { backgroundColor: "#ff2bd6", marginTop: 8 }]}
                        disabled={uploading}
                      >
                        <Text style={styles.actionButtonText}>
                          {uploading ? "Envoi..." : "Envoyer ma pièce d'identité"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Bouton d'emprunt (visible seulement si pièce vérifiée) */}
                {profile?.id_document_status === "verified" ? (
                  <TouchableOpacity onPress={requestLoan} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>{t("msg.request_loan")}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.note}>
                    {profile?.id_document_status === "pending"
                      ? "Ta pièce d'identité est en cours de vérification. Tu pourras emprunter une fois validée."
                      : "Envoie ta pièce d'identité pour pouvoir emprunter."}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.note}>{t("msg.plan_no_loan")}</Text>
            )}
          </View>
        )}

        {/* === SECTION RÉSERVATION POUR INSTRUMENTS PREMIUM (SUR PLACE) === */}
        {item.access_type === "premium" && item.acquired && (
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>{t("ttl.booking")}</Text>

            <View style={styles.actionInfo}>
              <Text style={styles.actionInfoLabel}>{t("msg.instrument")}</Text>
              <Text style={styles.actionInfoValue}>{t("msg.use_onsite")}</Text>
            </View>

            <View style={styles.actionInfo}>
              <Text style={styles.actionInfoLabel}>{t("msg.slot_duration")}</Text>
              <Text style={styles.actionInfoValue}>{t("msg.3_hours")}</Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push({ pathname: "/reserve", params: { instrument_id: id } })}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>{t("msg.book_slot")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* === SECTION INSTRUMENTS SUR PLACE (non premium, non empruntables) === */}
        {!item.borrowable &&
          item.acquired &&
          (!item.name || !(item.name || "").startsWith("Poste Premium")) && (
            <Text style={styles.note}>{t("msg.instrument_onsite")}</Text>
          )}

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  scroll: {
    padding: 24,
    gap: 10,
  },

  photoWrap: {
    marginHorizontal: -24,
    alignItems: "center",
  },

  photo: {
    width: "100%",
    height: H,
    marginHorizontal: -24,
    backgroundColor: "#000",
  },

  photoEmpty: {
    width: "100%",
    height: H,
    marginHorizontal: -24,
    alignItems: "center",
    justifyContent: "center",
  },

  photoLetter: {
    color: "#fff",
    fontSize: 90,
    fontWeight: "bold",
    fontStyle: "italic",
  },

  brandTitle: {
    color: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 15,
  },

  name: {
    fontSize: 26,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
    letterSpacing: 1,
  },

  meta: {
    color: "#fff",
    fontSize: 15,
  },

  stickyHeader: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },

  yearInline: {
    color: "#ff2bd6",
    fontSize: 15,
    fontWeight: "bold",
    fontStyle: "italic",
  },

  badges: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 8,
  },

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

  // === SECTION EMPRUNT / RÉSERVATION ===
  actionCard: {
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 16,
    padding: 20,
    gap: 16,
    backgroundColor: "rgba(255, 43, 214, 0.04)",
    marginVertical: 8,
  },

  actionTitle: {
    color: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 18,
  },

  actionInfo: {
    gap: 4,
  },

  actionInfoLabel: {
    color: "#8e8e93",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontStyle: "italic",
  },

  actionInfoValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontStyle: "italic",
  },

  weeksSection: {
    gap: 10,
  },

  weeksLabel: {
    color: "#ff2bd6",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontStyle: "italic",
  },

  weeksRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },

  weekChip: {
    width: 64,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  },

  weekChipSelected: {
    borderColor: "#ff2bd6",
    backgroundColor: "#ff2bd6",
    shadowColor: "#ff2bd6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },

  weekDay: {
    color: "#999",
    fontSize: 20,
    fontWeight: "700",
    fontStyle: "italic",
  },

  weekDaySelected: {
    color: "#fff",
  },

  weekMonth: {
    color: "#666",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  weekMonthSelected: {
    color: "rgba(255, 255, 255, 0.9)",
  },

  actionButton: {
    backgroundColor: "#ff2bd6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#ff2bd6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },

  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontStyle: "italic",
  },

  note: {
    color: "#8e8e93",
    fontStyle: "italic",
  },

  msg: {
    color: "#fff",
    textAlign: "center",
    marginTop: 8,
  },

  label: {
    color: "#fff",
    marginTop: 8,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  videoWrap: {
    gap: 6,
    marginTop: 4,
  },

  videoTitle: {
    color: "#ff2bd6",
    fontSize: 13,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  video: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#000",
    overflow: "hidden",
  },

  desc: {
    color: "#8e8e93",
    fontSize: 14,
    lineHeight: 20,
  },

  packageItem: {
    color: "#fff",
    fontSize: 14,
    fontStyle: "italic",
  },

  zoomBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },

  zoomImage: {
    width: "100%",
    height: "100%",
  },
});
