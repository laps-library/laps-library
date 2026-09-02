import { useLang } from "../lib/i18n";
import { useEffect, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import BackButton from "../components/BackButton";
export default function MyLoansScreen() {
  const { t } = useLang();
  const [loans, setLoans] = useState<any[]>([]);

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    const { data } = await supabase
      .from("loans")
      .select("*, physical_units(serial_number, instrument_models(name, brand))")
      .eq("user_id", sess.session?.user.id)
      .or("payment_status.eq.paid,status.eq.requested")
      .order("created_at", { ascending: false });
    setLoans(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const statusLabel = (s: string, startDate?: string) => {
    if (s === "active" && startDate) {
      const start = new Date(startDate);
      const now = new Date();
      if (start > now) return "À venir";
      return "En cours";
    }
    switch (s) {
      case "requested":
        return "En attente de validation";
      case "active":
        return "En cours";
      case "overdue":
        return "En retard";
      case "returned":
        return "Retourné";
      case "cancelled":
        return "Annulé";
      default:
        return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "requested":
        return "#f5a623";
      case "active":
        return "#ff2bd6";
      case "overdue":
        return "#f87171";
      case "returned":
        return "#8e8e93";
      case "cancelled":
        return "#8e8e93";
      default:
        return "#fff";
    }
  };

  async function cancelLoan(id: string) {
    await supabase.from("loans").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <Text style={styles.title}>{t("ttl.my_loans")}</Text>
      <FlatList
        data={loans}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t("msg.no_loan")}</Text>}
        renderItem={({ item }) => {
          const instrName = item.physical_units?.instrument_models?.name || t("msg.instrument");
          const instrBrand = item.physical_units?.instrument_models?.brand || "";
          const canModify = item.status === "requested" || item.status === "active";
          const canCancel = item.status === "requested";

          return (
            <View style={styles.card}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <Text style={styles.name}>{instrName}</Text>
                <View
                  style={{
                    backgroundColor: statusColor(item.status),
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: "700",
                      textTransform: "uppercase",
                    }}
                  >
                    {statusLabel(item.status, item.start_date)}
                  </Text>
                </View>
              </View>

              {instrBrand ? <Text style={styles.meta}>{instrBrand}</Text> : null}

              {item.start_date && (
                <Text style={styles.meta}>
                  Début :{" "}
                  {new Date(item.start_date).toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              )}

              {item.due_at && (
                <Text style={styles.meta}>
                  Retour prévu :{" "}
                  {new Date(item.due_at).toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              )}

              {item.duration_weeks && (
                <Text style={styles.meta}>Durée : {item.duration_weeks} semaine(s)</Text>
              )}

              {item.payment_status && (
                <Text style={styles.meta}>
                  Paiement :{" "}
                  {item.payment_status === "paid"
                    ? "✅ Payé"
                    : item.payment_status === "unpaid"
                      ? "⏳ En attente"
                      : item.payment_status}
                </Text>
              )}

              {canModify && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/modify/[id]",
                        params: { id: item.id, type: "loan" },
                      })
                    }
                    style={styles.btnModify}
                  >
                    <Text style={styles.btnText}>{t("msg.edit_2")}</Text>
                  </TouchableOpacity>

                  {canCancel && (
                    <TouchableOpacity onPress={() => cancelLoan(item.id)} style={styles.btnCancel}>
                      <Text style={styles.btnText}>{t("msg.cancel")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  title: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 26,
    color: "#fff",
    paddingHorizontal: 24,
    paddingBottom: 8,
    letterSpacing: 1,
  },
  list: { padding: 24, gap: 12 },
  empty: { color: "#8e8e93", fontStyle: "italic" },
  card: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 4,
    backgroundColor: "#000",
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
  meta: { color: "#ccc", fontSize: 13 },
  btnModify: {
    backgroundColor: "#ff2bd6",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnCancel: {
    backgroundColor: "#f87171",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
