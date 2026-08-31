import { useEffect, useState } from "react";
import { Button, Linking, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import BackButton from "../components/BackButton";

export default function AdminScreen() {
  const [pendingIds, setPendingIds] = useState<any[]>([]);
  const [pendingVal, setPendingVal] = useState<any[]>([]);
  const [todayRes, setTodayRes] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  async function load() {
    const { data: ids } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, id_document_url")
      .eq("id_document_status", "pending");
    setPendingIds(ids ?? []);

    const { data: pv } = await supabase
      .from("reservations")
      .select(
        "*, profiles(first_name, last_name), workstations(name), time_slots(name), instrument_models(name)",
      )
      .eq("status", "pending_validation");
    setPendingVal(pv ?? []);

    const today = new Date().toISOString().split("T")[0];
    const { data: res } = await supabase
      .from("reservations")
      .select("*, profiles(first_name, last_name), workstations(name), time_slots(name)")
      .eq("reservation_date", today);
    setTodayRes(res ?? []);

    const { data: ln } = await supabase
      .from("loans")
      .select(
        "*, profiles!user_id(first_name, last_name), physical_units(instrument_models(name), serial_number)",
      )
      .in("status", ["requested", "active"])
      .order("created_at", { ascending: false });
    setLoans(ln ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function setIdStatus(id: string, status: string) {
    await supabase
      .from("profiles")
      .update({
        id_document_status: status,
        id_verified_at: status === "verified" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    load();
  }

  async function setResStatus(id: string, status: string) {
    await supabase.from("reservations").update({ status }).eq("id", id);
    if (status === "confirmed") {
      try {
        await supabase.functions.invoke("supervised_email", { body: { reservation_id: id } });
      } catch (e) {}
    }
    load();
  }

  async function validateSupervised(id: string) {
    await supabase.from("reservations").update({ status: "pending_payment" }).eq("id", id);
    try {
      await supabase.functions.invoke("supervised_email", { body: { reservation_id: id } });
    } catch (e) {}
    load();
  }

  async function startLoan(id: string) {
    // 1. Récupérer le prêt avec les infos utilisateur et unité
    const { data: loan } = await supabase
      .from("loans")
      .select("*, physical_units(instrument_model_id)")
      .eq("id", id)
      .single();

    if (!loan) return;

    // 2. Calculer due_at basé sur start_date + 7 jours
    const startDate = loan.start_date ? new Date(loan.start_date) : new Date();
    const dueAt = new Date(startDate);
    dueAt.setDate(dueAt.getDate() + 7);

    // 3. Mettre à jour le prêt
    await supabase
      .from("loans")
      .update({
        status: "active",
        payment_status: "unpaid",
        started_at: startDate.toISOString(),
        due_at: dueAt.toISOString(),
      })
      .eq("id", id);

    // 4. Marquer l'unité comme empruntée
    if (loan.physical_unit_id) {
      await supabase
        .from("physical_units")
        .update({
          status: "borrowed",
        })
        .eq("id", loan.physical_unit_id);
    }

    // 5. Envoyer une notification à l'utilisateur
    await supabase.from("notifications").insert({
      user_id: loan.user_id,
      type: "loan_approved",
      title: "Votre emprunt a été validé !",
      message: `Votre emprunt commence le ${startDate.toLocaleDateString("fr-FR")} et se termine le ${dueAt.toLocaleDateString("fr-FR")}.`,
      data: { loan_id: id },
    });

    load();
  }

  async function refuseLoan(id: string) {
    // 1. Récupérer le prêt
    const { data: loan } = await supabase
      .from("loans")
      .select("*, physical_units(instrument_model_id)")
      .eq("id", id)
      .single();

    if (!loan) return;

    // 2. Annuler le prêt
    await supabase
      .from("loans")
      .update({
        status: "cancelled",
      })
      .eq("id", id);

    // 3. Remettre l'unité en disponible
    if (loan.physical_unit_id) {
      await supabase
        .from("physical_units")
        .update({
          status: "available",
        })
        .eq("id", loan.physical_unit_id);
    }

    // 4. Envoyer une notification à l'utilisateur
    await supabase.from("notifications").insert({
      user_id: loan.user_id,
      type: "loan_refused",
      title: "Votre demande d'emprunt a été refusée",
      message:
        "Malheureusement, votre demande n'a pas pu être acceptée. Contactez LAPS pour plus d'informations.",
      data: { loan_id: id },
    });

    load();
  }

  async function returnLoan(id: string) {
    // 1. Récupérer le prêt
    const { data: loan } = await supabase
      .from("loans")
      .select("physical_unit_id")
      .eq("id", id)
      .single();

    // 2. Marquer comme retourné
    await supabase
      .from("loans")
      .update({
        status: "returned",
        returned_at: new Date().toISOString(),
      })
      .eq("id", id);

    // 3. Remettre l'unité en disponible
    if (loan?.physical_unit_id) {
      await supabase
        .from("physical_units")
        .update({
          status: "available",
        })
        .eq("id", loan.physical_unit_id);
    }

    load();
  }

  async function viewDoc(url: string) {
    const { data } = await supabase.storage.from("id-documents").createSignedUrl(url, 3600);
    if (data?.signedUrl) Linking.openURL(data.signedUrl);
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Administration</Text>

        <AppButton label="Comptes" onPress={() => router.push("/admin-accounts")} />
        <AppButton label="Inventaire par poste" onPress={() => router.push("/stations")} />
        <AppButton label="Photos & manuels" onPress={() => router.push("/admin-media")} />
        <AppButton label="Publier une actualité" onPress={() => router.push("/admin-news")} />
        <AppButton label="Calendrier global" onPress={() => router.push("/admin-calendar")} />
        <Text style={styles.section}>Pièces à vérifier ({pendingIds.length})</Text>
        {pendingIds.length === 0 && <Text style={styles.empty}>Aucune.</Text>}
        {pendingIds.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.name}>
              {p.first_name} {p.last_name}
            </Text>
            <Text style={styles.info}>{p.email}</Text>
            <View style={styles.row}>
              <Button title="Voir" color="#60a5fa" onPress={() => viewDoc(p.id_document_url)} />
              <Button
                title="Valider"
                color="#ff2bd6"
                onPress={() => setIdStatus(p.id, "verified")}
              />
              <Button
                title="Refuser"
                color="#f87171"
                onPress={() => setIdStatus(p.id, "rejected")}
              />
            </View>
          </View>
        ))}

        <Text style={styles.section}>Créneaux supervisés à valider ({pendingVal.length})</Text>
        {pendingVal.length === 0 && <Text style={styles.empty}>Aucun.</Text>}
        {pendingVal.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.name}>
              {r.profiles?.first_name} {r.profiles?.last_name}
            </Text>
            <Text style={styles.info}>
              {new Date(r.reservation_date).toLocaleDateString("fr-FR")} · {r.time_slots?.name} ·{" "}
              {r.instrument_models?.name
                ? r.instrument_models.name.replace("Poste Premium — ", "")
                : r.workstations?.name}
            </Text>
            <View style={styles.row}>
              <Button title="Valider" color="#ff2bd6" onPress={() => validateSupervised(r.id)} />
              <Button
                title="Refuser"
                color="#f87171"
                onPress={() => setResStatus(r.id, "cancelled")}
              />
            </View>
          </View>
        ))}

        <Text style={styles.section}>Prêts ({loans.length})</Text>
        {loans.length === 0 && <Text style={styles.empty}>Aucun prêt actif.</Text>}
        {loans.map((l) => (
          <View key={l.id} style={styles.card}>
            <Text style={styles.name}>
              {l.physical_units?.instrument_models?.name || "Instrument"}
            </Text>
            <Text style={styles.info}>
              {l.profiles?.first_name} {l.profiles?.last_name}
            </Text>
            {l.physical_units?.serial_number && (
              <Text style={styles.info}>SN: {l.physical_units.serial_number}</Text>
            )}
            <Text style={styles.info}>
              Statut :{" "}
              {l.status === "requested"
                ? "Demande en attente"
                : l.status === "active"
                  ? "En cours"
                  : l.status}
            </Text>
            {l.start_date && (
              <Text style={styles.info}>
                Début souhaité : {new Date(l.start_date).toLocaleDateString("fr-FR")}
              </Text>
            )}
            {l.status === "requested" ? (
              <View style={styles.row}>
                <Button title="Valider" color="#ff2bd6" onPress={() => startLoan(l.id)} />
                <Button title="Refuser" color="#f87171" onPress={() => refuseLoan(l.id)} />
              </View>
            ) : l.status === "active" ? (
              <Button title="Retour" color="#f87171" onPress={() => returnLoan(l.id)} />
            ) : null}
          </View>
        ))}

        <Text style={styles.section}>Réservations du jour ({todayRes.length})</Text>
        {todayRes.length === 0 && <Text style={styles.empty}>Aucune.</Text>}
        {todayRes.map((r) => (
          <View key={r.id} style={styles.card}>
            <Text style={styles.name}>
              {r.profiles?.first_name} {r.profiles?.last_name}
            </Text>
            <Text style={styles.info}>
              {r.workstations?.name} — {r.time_slots?.name}
            </Text>
            <Text style={styles.info}>Statut : {r.status}</Text>
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
    fontSize: 28,
    color: "#fff",
    letterSpacing: 1,
  },
  section: {
    fontSize: 18,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
    marginTop: 16,
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
  info: { color: "#fff" },
  row: { flexDirection: "row", gap: 8 },
});
