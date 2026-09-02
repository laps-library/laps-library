import { useLang } from "../lib/i18n";
import LanguageSwitcher from "../components/LanguageSwitcher";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as ExpoLinking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { Link, router } from "expo-router";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";

const isFounder = (p: any) => p.code === "founding_member" || /fondateur/i.test(p.name);
const isLocked = (p: any) => /pro|nerd/i.test(p.name);

export default function RegisterScreen() {
  const { t, lang } = useLang();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("plans").select("*").order("sort_order");
      setPlans(data ?? []);
      const free = (data ?? []).find((p) => (p.price_cents === 0 || /newbie/i.test(p.name)) && !isLocked(p));
      if (free) setPlanId(free.id);
    }
    load();
  }, []);

  async function handleRegister() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, phone } },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (uid && planId) {
      const chosen = plans.find((p) => p.id === planId);
      if (chosen && isLocked(chosen)) {
        const free = plans.find((p) => (p.price_cents === 0 || /newbie/i.test(p.name)) && !isLocked(p));
        if (free) setPlanId(free.id);
        setLoading(false);
        setError("Cette formule n'est pas encore disponible. Merci de choisir NEWBIE pour le moment.");
        return;
      }
      await supabase.from("profiles").update({ plan_id: planId }).eq("id", uid);
      const chosen2 = plans.find((p) => p.id === planId);
      const isFree = chosen2 && (chosen2.price_cents === 0 || /newbie/i.test(chosen2.name));
      if (isFree) {
        setLoading(false);
        router.replace("/home");
        return;
      }
      // Formule payante : ouvrir Stripe
      const redirectUrl = ExpoLinking.createURL("payment-success");
      const { data: checkData, error: checkErr } = await supabase.functions.invoke(
        "create_checkout",
        {
          body: { plan_id: planId, user_id: uid, redirect_url: redirectUrl },
        },
      );
      if (checkData?.url) {
        await AsyncStorage.setItem("laps_pending_payment", "1");
        const result = await WebBrowser.openAuthSessionAsync(checkData.url, redirectUrl);
        setLoading(false);
        if (result.type === "success") {
          router.replace("/payment-success");
        } else {
          setError("Paiement annulé ou non finalisé.");
        }
      } else {
        setLoading(false);
        let detail = checkErr?.message || "inconnu";
        try {
          if (checkErr?.context) {
            const j = await checkErr.context.json();
            detail = JSON.stringify(j);
          }
        } catch (e) {}
        setError("PAIEMENT : " + detail);
      }
    } else {
      setLoading(false);
      router.replace(`/confirm-email?email=${encodeURIComponent(email)}`);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LanguageSwitcher />
        <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.subtitle}>{t("msg.signup")}</Text>

        <TextInput
          style={styles.input}
          placeholder={t("plh.first_name")}
          placeholderTextColor="#8e8e93"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder={t("plh.name")}
          placeholderTextColor="#8e8e93"
          value={lastName}
          onChangeText={setLastName}
        />
        <TextInput
          style={styles.input}
          placeholder={t("plh.email")}
          placeholderTextColor="#8e8e93"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={t("plh.phone")}
          placeholderTextColor="#8e8e93"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={styles.input}
          placeholder={t("plh.password")}
          placeholderTextColor="#8e8e93"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.planTitle}>{t("ttl.your_plan")}</Text>
        {plans.filter((p) => !isFounder(p)).map((p) => {
          const locked = isLocked(p);
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.planCard,
                planId === p.id && styles.planCardSelected,
                locked && styles.planCardDisabled,
              ]}
              onPress={() => {
                if (locked) return;
                setPlanId(p.id);
              }}
              activeOpacity={locked ? 1 : 0.85}
              disabled={locked}
            >
              <View style={styles.planHeaderRow}>
                <Text style={styles.planName}>{p.name}</Text>
                {locked && <Text style={styles.comingSoon}>{t("msg.soon")}</Text>}
              </View>
              <Text style={styles.planPrice}>
                {p.price_cents != null && p.price_cents > 0
                  ? `${(p.price_cents / 100).toFixed(2)} € / ${p.price_period === "year" ? (lang === "en" ? "year" : "an") : (lang === "en" ? "month" : "mois")}`
                  : (lang === "en" ? "Free" : "Gratuit")}
              </Text>
              {p.features ? <Text style={styles.planFeatures}>{lang === "en" && p.features_en ? p.features_en : p.features}</Text> : null}
            </TouchableOpacity>
          );
        })}

        {error && <Text style={styles.error}>{error}</Text>}

        <AppButton label={loading ? t("lbl.creating") : t("lbl.create_account")} onPress={handleRegister} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t("msg.have_account")}</Text>
          <Link href="/login" style={styles.link}>
            {t("lbl.login_link")}
          </Link>
        </View>
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { padding: 24, gap: 12 },
  logo: { width: "100%", height: 200, alignSelf: "center", marginTop: 40, marginBottom: 8 },
  subtitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#000",
    color: "#fff",
  },
  planTitle: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 18,
    color: "#fff",
    marginTop: 8,
    letterSpacing: 1,
  },
  planCard: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 12,
    padding: 14,
    gap: 4,
    backgroundColor: "#000",
  },
  planCardSelected: { borderWidth: 2, borderColor: "#ff2bd6", backgroundColor: "#000" },
  planCardDisabled: { opacity: 0.5 },
  planHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  comingSoon: {
    color: "#ff2bd6",
    fontSize: 10,
    fontStyle: "italic",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
    letterSpacing: 1,
  },
  planPrice: { color: "#8e8e93", fontSize: 13 },
  planFeatures: { color: "#8e8e93", fontSize: 12, lineHeight: 17 },
  error: { color: "#fff", textAlign: "center" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16, gap: 6 },
  footerText: { color: "#fff" },
  link: { color: "#fff", fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase" },
});
