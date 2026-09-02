import { useLang } from "../lib/i18n";
import { useEffect, useState } from "react";
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import BackButton from "../components/BackButton";

export default function AdminAccountsScreen() {
  const { t } = useLang();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  async function load() {
    const { data: acc } = await supabase
      .from("profiles")
      .select("*, plans(name)")
      .order("created_at", { ascending: false });
    setAccounts(acc ?? []);
    const { data: pl } = await supabase.from("plans").select("*").order("sort_order");
    setPlans(pl ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function setRole(id: string, role: string) {
    await supabase.from("profiles").update({ role }).eq("id", id);
    load();
  }

  async function setPlan(id: string, planId: string) {
    await supabase.from("profiles").update({ plan_id: planId }).eq("id", id);
    load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("ttl.accounts_2")}</Text>
        {accounts.length === 0 && <Text style={styles.empty}>{t("msg.no_account")}</Text>}
        {accounts.map((a) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.name}>
              {a.first_name || "—"} {a.last_name || ""}
            </Text>
            <Text style={styles.info}>{a.email}</Text>
            <Text style={styles.info}>Formule : {a.plans?.name ?? "—"}</Text>
            <Text style={styles.info}>
              Validité :{" "}
              {a.subscription_expires_at
                ? new Date(a.subscription_expires_at).toLocaleDateString("fr-FR")
                : "—"}
            </Text>
            <Text style={styles.info}>
              Pièce :{" "}
              {a.id_document_status === "verified"
                ? "Vérifiée"
                : a.id_document_status === "pending"
                  ? "En attente"
                  : a.id_document_status === "rejected"
                    ? "Refusée"
                    : "Non envoyée"}
            </Text>
            <Text style={styles.info}>Rôle : {a.role}</Text>
            <View style={styles.row}>
              {a.role === "client" ? (
                <Button
                  title={t("lbl.promote_admin")}
                  color="#ff2bd6"
                  onPress={() => setRole(a.id, "admin")}
                />
              ) : (
                <Button
                  title={t("lbl.demote_customer")}
                  color="#f87171"
                  onPress={() => setRole(a.id, "client")}
                />
              )}
            </View>
            <View style={styles.row}>
              {plans
                .filter((p) => p.id !== a.plan_id)
                .map((p) => (
                  <Button
                    key={p.id}
                    title={p.name}
                    color="#60a5fa"
                    onPress={() => setPlan(a.id, p.id)}
                  />
                ))}
            </View>
          </View>
        ))}
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
    letterSpacing: 1,
  },
  empty: { color: "#8e8e93", fontStyle: "italic" },
  card: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 8,
    backgroundColor: "#000",
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
  },
  info: { color: "#fff", fontSize: 14 },
  row: { flexDirection: "row", gap: 8, marginTop: 6 },
});
