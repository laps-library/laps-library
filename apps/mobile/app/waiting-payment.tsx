import { useLang } from "../lib/i18n";
import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";

export default function WaitingPaymentScreen() {
  const { t } = useLang();
  const [status, setStatus] = useState("checking");
  const [countdown, setCountdown] = useState(3);

  async function checkPayment() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) {
      router.replace("/login");
      return;
    }

    const { data: p } = await supabase
      .from("profiles")
      .select("plan_id, subscription_expires_at")
      .eq("id", uid)
      .single();
    const { data: plan } = await supabase.from("plans").select("*").eq("id", p?.plan_id).single();
    const free = plan && (plan.price_cents === 0 || /newbie/i.test(plan.name));

    if (free) {
      router.replace("/home");
      return;
    }

    const exp = p?.subscription_expires_at ? new Date(p.subscription_expires_at).getTime() : 0;
    if (exp > Date.now()) {
      router.replace("/home");
      return;
    }
    setStatus("waiting");
  }

  useEffect(() => {
    let stop = false;
    async function poll() {
      while (!stop) {
        await checkPayment();
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    poll();
    return () => {
      stop = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t("ttl.payment_in_progress")}</Text>
        <Text style={styles.msg}>
          {status === "checking"
            ? "Vérification en cours..."
            : "Ton abonnement sera activé dès la confirmation du paiement.\nLaisse la page Stripe ouverte."}
        </Text>
        <AppButton label={t("lbl.i_paid_check")} fontSize={14} onPress={checkPayment} />
        <AppButton
          label={t("lbl.back_to_choices")}
          fontSize={10}
          onPress={() => router.replace("/choose-plan")}
        />
        {countdown > 0 && <Text style={styles.countdown}>Vérification auto dans {countdown}s</Text>}
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 },
  title: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 22,
    color: "#fff",
    textAlign: "center",
    letterSpacing: 1,
  },
  msg: { color: "#8e8e93", fontStyle: "italic", fontSize: 14, textAlign: "center", lineHeight: 20 },
  countdown: { color: "#ff2bd6", fontSize: 12, marginTop: 8 },
});
