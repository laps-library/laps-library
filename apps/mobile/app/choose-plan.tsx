import { useLang } from "../lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as ExpoLinking from "expo-linking";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import BackButton from "../components/BackButton";

const rank = (n: string) => (/newbie/i.test(n) ? 0 : /pro/i.test(n) ? 1 : /nerd/i.test(n) ? 2 : 0);
const isFreePlan = (p: any) => p.price_cents === 0 || /newbie/i.test(p.name);
const isFounderPlan = (p: any) => p.code === "founding_member" || /fondateur/i.test(p.name);

export default function ChoosePlanScreen() {
  const { t } = useLang();
  const [plans, setPlans] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const id = sess.session?.user.id ?? null;
    setUid(id);
    if (!id) return;
    const { data: prof } = await supabase.from("profiles").select("plan_id").eq("id", id).single();
    if (prof?.plan_id) {
      const { data: cp } = await supabase.from("plans").select("*").eq("id", prof.plan_id).single();
      setCurrent(cp);
    }
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    setPlans(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") load();
    });
    return () => sub.remove();
  }, [load]);

  const currentRank = current ? rank(current.name) : -1;
  const upgrades =
    currentRank === -1
      ? plans.filter((p) => !isFreePlan(p) && !isFounderPlan(p))
      : plans.filter((p) => rank(p.name) > currentRank && !isFreePlan(p) && !isFounderPlan(p));
  const canCancel = !!current && /nerd/i.test(current.name);

  async function choose(p: any) {
    if (!uid) {
      setMsg("Session introuvable, reconnecte-toi.");
      return;
    }
    setLoading(p.id);
    setMsg("Création de la session Stripe...");
    const redirectUrl = ExpoLinking.createURL("payment-success");
    const { data, error } = await supabase.functions.invoke("create_checkout", {
      body: { plan_id: p.id, user_id: uid, redirect_url: redirectUrl },
    });
    if (error) {
      setLoading(null);
      setMsg("Erreur fonction : " + error.message);
      return;
    }
    if (!data?.url) {
      setLoading(null);
      setMsg("Réponse inattendue : " + JSON.stringify(data));
      return;
    }
    setMsg("Ouverture de Stripe…");
    await AsyncStorage.setItem("laps_pending_payment", "1");
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    setLoading(null);
    if (result.type === "success") {
      router.replace("/payment-success");
    } else {
      setMsg("Paiement annulé ou non finalisé.");
    }
  }

  async function cancel() {
    const free = plans.find(isFreePlan);
    if (!free || !uid) {
      setMsg("Formule gratuite introuvable.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ plan_id: free.id, subscription_expires_at: null })
      .eq("id", uid);
    if (error) setMsg("Erreur : " + error.message);
    else router.replace("/home");
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("ttl.manage_plan")}</Text>
        <Text style={styles.hint}>Formule actuelle : {current?.name ?? "aucune"}</Text>
        <Text style={styles.info}>{t("msg.annual_subs")}</Text>

        {upgrades.map((p) => {
          const isFounder = isFounderPlan(p);
          return (
            <View key={p.id} style={[styles.card, isFounder && styles.cardFounder]}>
              {isFounder && <Text style={styles.founderBadgeTop}>{t("ttl.limited_offer")}</Text>}
              <View style={styles.headerRow}>
                <Text style={styles.name}>{p.name}</Text>
                {isFounder && <Text style={styles.badge}>{t("ttl.until_31_10")}</Text>}
              </View>
              
              {isFounder ? (
                <View style={styles.founderPriceContainer}>
                  <Text style={styles.priceLabel}>{t("msg.exclusive_rate")}</Text>
                  <Text style={styles.priceBold}>
                    {p.price_cents != null && p.price_cents > 0
                      ? `${(p.price_cents / 100).toFixed(2)} € / ${p.price_period === "year" ? "an" : "mois"}`
                      : "Gratuit"}
                  </Text>
                  <Text style={styles.deadline}>{t("msg.limited_offer_expire")}</Text>
                </View>
              ) : (
                <Text style={styles.price}>
                  {p.price_cents != null && p.price_cents > 0
                    ? `${(p.price_cents / 100).toFixed(2)} € / ${p.price_period === "year" ? "an" : "mois"}`
                    : "Gratuit"}
                </Text>
              )}
              
              {p.features ? <Text style={styles.features}>{p.features}</Text> : null}

              {/pro/i.test(p.name) && (
                <Text style={styles.features}>
                  _Cartes créneaux PRO : 5 créneaux 62,50 € (12,50 €/créneau) · 10 créneaux 100 € (10
                  €/créneau), créneaux de 10 h à 15 h.
                </Text>
              )}
              <AppButton
                label={/pro|nerd/i.test(p.name) ? t("msg.soon") : (loading === p.id ? "..." : "Upgrader")}
                fontSize={14}
                onPress={/pro|nerd/i.test(p.name) ? (() => {}) : (() => choose(p))}
                style={/pro|nerd/i.test(p.name) ? styles.buttonDisabled : undefined}
              />
            </View>
          );
        })}
        {upgrades.length === 0 && (
          <Text style={styles.hint}>{t("ttl.no_upgrade")}</Text>
        )}

        {canCancel && (
          <AppButton
            label={t("lbl.cancel_subscription")}
            onPress={() =>
              Alert.alert("Résilier", "Tu repasseras à la formule gratuite immédiatement.", [
                { text: t("msg.cancel"), style: "cancel" },
                { text: "Résilier", style: "destructive", onPress: cancel },
              ])
            }
          />
        )}

        <AppButton
          label={t("lbl.terms")}
          fontSize={12}
          onPress={() => router.push("/cgv")}
        />

        {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { padding: 24, gap: 12 },
  title: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 26,
    color: "#fff",
    paddingBottom: 8,
    letterSpacing: 1,
  },
  hint: { color: "#8e8e93", fontStyle: "italic", fontSize: 13, lineHeight: 18 },
  info: {
    color: "#8e8e93",
    fontStyle: "italic",
    fontSize: 12,
    lineHeight: 16,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  card: {
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 12,
    padding: 16,
    gap: 10,
    backgroundColor: "#000",
  },
  cardFounder: {
    borderColor: "#ffd700",
    backgroundColor: "rgba(255, 215, 0, 0.05)",
    borderWidth: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  name: {
    fontSize: 17,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
    letterSpacing: 1,
    flex: 1,
  },
  founderBadgeTop: {
    backgroundColor: "#ffd700",
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  badge: {
    backgroundColor: "#ffd700",
    color: "#000",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    textAlign: "center",
    flexShrink: 1,
  },
  price: { color: "#8e8e93", fontSize: 14 },
  founderPriceContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#ffd700",
    gap: 4,
  },
  priceLabel: {
    color: "#ffd700",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priceBold: {
    color: "#ffd700",
    fontSize: 20,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
  deadline: {
    color: "#ffd700",
    fontSize: 11,
    fontWeight: "600",
    fontStyle: "italic",
    marginTop: 2,
  },
  features: { color: "#8e8e93", fontSize: 12, lineHeight: 17 },

  buttonDisabled: { opacity: 0.5 },
  msg: { color: "#fff", textAlign: "center", marginTop: 8 },
});
