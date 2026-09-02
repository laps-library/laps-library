import { useLang } from "../lib/i18n";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import * as ExpoLinking from "expo-linking";

async function doLogout() {
  await supabase.auth.signOut();
  router.replace("/login");
}

export default function ProfileScreen() {
  const { t, lang } = useLang();
  function fmtHour(h) {
    const n = parseInt(h, 10);
    const ampm = n >= 12 ? "pm" : "am";
    let hh = n % 12;
    if (hh === 0) hh = 12;
    return hh + ampm;
  }

  function trSlotName(name) {
    if (!name) return name;
    if (lang === "en") {
      return String(name)
        .replace(/Créneau/g, "Slot")
        .replace(/(\d{1,2})h à (\d{1,2})h/g, (m, a, b) => fmtHour(a) + " to " + fmtHour(b));
    }
    return name;
  }



  function translateNotifTitle(title) {
    if (lang === "fr") return title;
    if (title === "Votre emprunt a été validé !") return t("notif.loan_approved_title");
    return title;
  }

  function translateNotifMessage(msg) {
    if (lang === "fr") return msg;
    const match = msg.match(/Votre emprunt commence le (.+?) et se termine le (.+?)\./);
    if (match) {
      return t("notif.loan_approved_msg") + match[1] + t("notif.loan_approved_msg_mid") + match[2] + t("notif.loan_approved_msg_end");
    }
    return msg;
  }


  const [profile, setProfile] = useState<any>(null);
  const [pseudo, setPseudo] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [privatizations, setPrivatizations] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loanPayments, setLoanPayments] = useState<Record<string, string>>({});

  async function load() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile(data);
    setPseudo(data?.pseudo ?? "");
    if (data?.plan_id) {
      const { data: pl } = await supabase.from("plans").select("*").eq("id", data.plan_id).single();
      setPlan(pl);
    }
    const { data: res } = await supabase
      .from("reservations")
      .select(
        "id, reservation_date, start_time, status, amount_cents, workstations(name), time_slots(name), instrument_models(name)",
      )
      .eq("user_id", uid)
      .order("reservation_date")
      .limit(5);
    setReservations(res ?? []);
    const { data: ln } = await supabase
      .from("loans")
      .select(
        "id, status, payment_status, duration_weeks, start_date, physical_units(instrument_models(name))",
      )
      .eq("user_id", uid)
      .neq("status", "returned")
      .or("payment_status.eq.paid,status.eq.requested")
      .limit(5);
    setLoans(ln ?? []);

    const { data: notifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifications(notifs ?? []);

    // Charger les statuts de paiement des prêts mentionnés dans les notifications
    const loanIds = (notifs ?? [])
      .filter((n) => n.type === "loan_approved" && n.data?.loan_id)
      .map((n) => n.data.loan_id);

    if (loanIds.length > 0) {
      const { data: loanData } = await supabase
        .from("loans")
        .select("id, payment_status")
        .in("id", loanIds);

      const payments: Record<string, string> = {};
      (loanData ?? []).forEach((l) => {
        payments[l.id] = l.payment_status || "unpaid";
      });
      setLoanPayments(payments);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAsRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((notifs) => notifs.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const { data } = await supabase
        .from("privatizations")
        .select("id, privat_date, amount_cents, status")
        .eq("user_id", uid)
        .order("privat_date");
      setPrivatizations(data ?? []);
    })();
  }, []);

  async function payLoan(l: any) {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const redirectUrl = ExpoLinking.createURL("payment-success");

    const { data, error } = await supabase.functions.invoke("create_payment", {
      body: {
        user_id: uid,
        amount_cents: l.amount_cents ?? 0,
        label: "Emprunt instrument",
        kind: "loan",
        loan_id: l.id,
        redirect_url: redirectUrl,
      },
    });

    if (error || !(data as any)?.url) {
      Alert.alert("Erreur", "Impossible de lancer le paiement.");
      return;
    }

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("laps_pending_payment", "1");
    Linking.openURL((data as any).url);
  }

  async function cancelLoan(l: any) {
    const { error } = await supabase.rpc("cancel_loan", { p_loan_id: l.id });
    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    setLoans((prev) => prev.filter((x) => x.id !== l.id));
  }

  async function payPrivatization(pz: any) {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const redirectUrl = ExpoLinking.createURL("payment-success");

    const { data, error } = await supabase.functions.invoke("create_payment", {
      body: {
        user_id: uid,
        amount_cents: pz.amount_cents ?? 44000,
        label: "Privatisation LAPS Library",
        kind: "privatization",
        privatization_id: pz.id,
        redirect_url: redirectUrl,
      },
    });

    if (error || !(data as any)?.url) {
      Alert.alert("Erreur", "Impossible de lancer le paiement.");
      return;
    }

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("laps_pending_payment", "1");
    Linking.openURL((data as any).url);
  }

  async function cancelPrivatization(pz: any) {
    const { error } = await supabase.rpc("cancel_privatization", { p_privatization_id: pz.id });
    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    setPrivatizations((prev) => prev.filter((x) => x.id !== pz.id));
  }

  async function payLoan(loanId: string) {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const redirectUrl = ExpoLinking.createURL("payment-success");

    const { data, error } = await supabase.functions.invoke("create_payment", {
      body: {
        user_id: uid,
        amount_cents: 1000,
        label: "Emprunt instrument",
        kind: "loan",
        loan_id: loanId,
        redirect_url: redirectUrl,
      },
    });

    if (error || !(data as any)?.url) {
      Alert.alert("Erreur", "Impossible de lancer le paiement.");
      return;
    }

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("laps_pending_payment", "loan");
    Linking.openURL((data as any).url);
  }

  async function payReservation(r: any) {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    const redirectUrl = ExpoLinking.createURL("payment-success");

    const { data, error } = await supabase.functions.invoke("create_payment", {
      body: {
        user_id: uid,
        amount_cents: r.amount_cents ?? 0,
        label: "Créneau LAPS Library",
        kind: "reservation",
        reservation_id: r.id,
        redirect_url: redirectUrl,
      },
    });

    if (error || !(data as any)?.url) {
      Alert.alert("Erreur", "Impossible de lancer le paiement.");
      return;
    }

    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    await AsyncStorage.setItem("laps_pending_payment", "1");
    Linking.openURL((data as any).url);
  }

  async function cancelReservation(r: any) {
    const { error } = await supabase.rpc("cancel_reservation", { p_reservation_id: r.id });
    if (error) {
      Alert.alert("Erreur", error.message);
      return;
    }
    setReservations((prev) => prev.filter((x) => x.id !== r.id));
  }

  async function markAllAsRead() {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", uid);
    setNotifications((notifs) => notifs.map((n) => ({ ...n, is_read: true })));
  }

  async function savePseudo() {
    const value = pseudo.trim();
    if (value && (value.length < 2 || value.length > 30)) {
      Alert.alert("Pseudo invalide", "Le pseudo doit faire entre 2 et 30 caractères.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ pseudo: value || null })
      .eq("id", profile.id);
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        Alert.alert("Pseudo déjà pris", "Ce pseudo est déjà utilisé. Choisis-en un autre.");
      } else {
        Alert.alert("Erreur", error.message);
      }
      return;
    }
    Alert.alert("Enregistré", "Ton pseudo public a été mis à jour.");
    load();
  }

  async function pickDocument() {
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
      load();
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Échec de l'envoi.");
    } finally {
      setUploading(false);
    }
  }

  async function viewDocument() {
    if (!profile?.id_document_url) return;
    const { data } = await supabase.storage
      .from("id-documents")
      .createSignedUrl(profile.id_document_url, 3600);
    if (data?.signedUrl) Linking.openURL(data.signedUrl);
  }



  const statusLabel = (s: string | null) =>
    s === "verified"
      ? t("prof.verified")
      : s === "rejected"
        ? "Refusée"
        : s === "pending"
          ? "En attente"
          : "Non envoyée";

  const isFree = plan && (plan.price_cents === 0 || /gratuite|newbie/i.test(plan.name));
  const validity = profile?.subscription_expires_at
    ? `${t("prof.valid_until")}${new Date(profile.subscription_expires_at).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}`
    : isFree
      ? "Sans expiration"
      : "Activation en attente";

  async function handleDelete() {
    Alert.alert(t("alert.delete_title"), t("alert.delete_msg"), [
      { text: t("msg.cancel"), style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          await supabase.rpc("delete_own_account");
          await supabase.auth.signOut();
          router.replace("/login");
        },
      },
    ]);
  }

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <LanguageSwitcher align="left" />
          </View>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            {plan ? <Text style={styles.planBadge}>{plan.name}</Text> : null}
          </View>
        </View>

        <View style={styles.bigCard}>
          <Text style={styles.section}>
            _Notifications ({notifications.filter((n) => !n.is_read).length})
          </Text>
          {notifications.length === 0 ? (
            <Text style={styles.empty}>{t("msg.no_notification")}</Text>
          ) : (
            <View>
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <TouchableOpacity
                  onPress={markAllAsRead}
                  style={{ marginBottom: 8, alignSelf: "flex-end" }}
                >
                  <Text style={{ color: "#ff2bd6", fontSize: 12, fontStyle: "italic" }}>
                    {t("notif.mark_all_read")}
                  </Text>
                </TouchableOpacity>
              )}
              {notifications.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => markAsRead(n.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: n.is_read ? "#333" : "#ff2bd6",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 8,
                    backgroundColor: n.is_read ? "rgba(255,255,255,0.02)" : "rgba(255,43,214,0.08)",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "600",
                        fontSize: 13,
                        fontStyle: "italic",
                        flex: 1,
                      }}
                    >
                      {translateNotifTitle(n.title)}
                    </Text>
                    {!n.is_read && (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#ff2bd6",
                          marginLeft: 8,
                        }}
                      />
                    )}
                  </View>
                  <Text style={{ color: "#ccc", fontSize: 12, marginBottom: 4 }}>{translateNotifMessage(n.message)}</Text>
                  {n.type === "loan_approved" &&
                    n.data?.loan_id &&
                    !n.is_read &&
                    (loanPayments[n.data.loan_id] === "paid" ? (
                      <View
                        style={{
                          backgroundColor: "rgba(76, 217, 100, 0.1)",
                          borderColor: "#4cd964",
                          borderWidth: 1,
                          borderRadius: 8,
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          marginTop: 8,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#4cd964",
                            fontWeight: "700",
                            fontSize: 13,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          {t("notif.loan_confirmed_paid")}
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => payLoan(n.data.loan_id)}
                        style={{
                          backgroundColor: "#ff2bd6",
                          borderRadius: 8,
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          marginTop: 8,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontWeight: "700",
                            fontSize: 13,
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          Confirmer et payer (10 EUR)
                        </Text>
                      </TouchableOpacity>
                    ))}
                  <Text style={{ color: "#666", fontSize: 10, fontStyle: "italic", marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.section}>{t("ttl.public_nickname")}</Text>
          <Text style={styles.label}>{t("ttl.on_forum")}</Text>
          <TextInput
            style={styles.input}
            value={pseudo}
            onChangeText={setPseudo}
            placeholder={t("plh.public_nickname")}
            placeholderTextColor="#8e8e93"
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <AppButton label={t("lbl.save_nickname")} onPress={savePseudo} />

          <Text style={styles.section}>{t("ttl.personal_info")}</Text>
          <Text style={styles.label}>{t("ttl.first_name")}</Text>
          <Text style={styles.value}>{profile.first_name}</Text>
          <Text style={styles.label}>{t("ttl.name")}</Text>
          <Text style={styles.value}>{profile.last_name}</Text>
          <Text style={styles.label}>{t("ttl.email")}</Text>
          <Text style={styles.value}>{profile.email}</Text>
          <Text style={styles.label}>{t("ttl.phone")}</Text>
          <Text style={styles.value}>{profile.phone || "-"}</Text>

          <Text style={styles.section}>{t("ttl.my_slots")}</Text>
          {reservations.length === 0 && (
            <Text style={styles.empty}>{t("msg.no_upcoming_booking")}</Text>
          )}
          {reservations.map((r) => (
            <View key={r.id} style={styles.resCard}>
              <Text style={styles.line}>
                _{" "}
                {new Date(r.reservation_date).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}{" "}
                · {trSlotName(r.time_slots?.name)} ·{" "}
                {r.instrument_models?.name
                  ? r.instrument_models.name.replace("Poste Premium — ", "")
                  : r.workstations?.name}
              </Text>
              {r.status === "pending_payment" && (
                <>
                  <Text style={styles.resStatus}>{t("ttl.awaiting_payment")}</Text>
                  <View style={styles.resActions}>
                    <TouchableOpacity style={styles.resPayBtn} onPress={() => payReservation(r)}>
                      <Text style={styles.resPayText}>{t("msg.pay")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resCancelBtn} onPress={() => cancelReservation(r)}>
                      <Text style={styles.resCancelText}>{t("msg.cancel_up")}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))}
          <Text style={styles.section}>{t("ttl.my_privatizations")}</Text>
          {privatizations.length === 0 && (
            <Text style={styles.empty}>{t("msg.no_privatization")}</Text>
          )}
          {privatizations.map((pz) => (
            <View key={pz.id} style={styles.resCard}>
              <Text style={styles.line}>
                _{" "}
                {new Date(pz.privat_date + "T12:00:00").toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}{" "}
                · {t("prof.full_studio")}
              </Text>
              {pz.status === "pending_payment" && (
                <>
                  <Text style={styles.resStatus}>{t("ttl.awaiting_payment")}</Text>
                  <View style={styles.resActions}>
                    <TouchableOpacity style={styles.resPayBtn} onPress={() => payPrivatization(pz)}>
                      <Text style={styles.resPayText}>{t("msg.pay")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.resCancelBtn} onPress={() => cancelPrivatization(pz)}>
                      <Text style={styles.resCancelText}>{t("msg.cancel_up")}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))}

          <AppButton
            label={t("lbl.manage_bookings")}
            fontSize={10}
            onPress={() => router.push("/my-reservations")}
          />

          <Text style={styles.section}>{t("ttl.my_loans")}</Text>
          {loans.length === 0 && <Text style={styles.empty}>{t("msg.no_active_loan")}</Text>}
          {loans.map((l) => {
            let statusText = l.status;
            if (l.status === "requested") {
              statusText = "En attente";
            } else if (l.status === "active") {
              const start = l.start_date ? new Date(l.start_date) : null;
              const now = new Date();
              statusText = start && start > now ? "À venir" : "En cours";
            }
            return (
              <View key={l.id} style={styles.resCard}>
                <Text style={styles.line}>
                  _ {l.physical_units?.instrument_models?.name || t("msg.instrument")} ·{" "}
                  {l.start_date
                    ? new Date(l.start_date).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
                        day: "numeric",
                        month: "short",
                      }) + " · "
                    : ""}
                  {statusText}
                </Text>
                {l.status === "requested" && l.payment_status === "unpaid" && (
                  <>
                    <Text style={styles.resStatus}>{t("ttl.awaiting_payment")}</Text>
                    <View style={styles.resActions}>
                      <TouchableOpacity style={styles.resPayBtn} onPress={() => payLoan(l)}>
                        <Text style={styles.resPayText}>{t("msg.pay")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.resCancelBtn} onPress={() => cancelLoan(l)}>
                        <Text style={styles.resCancelText}>{t("msg.cancel_up")}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          })}
          <AppButton
            label={t("lbl.manage_loans")}
            fontSize={10}
            onPress={() => router.push("/my-loans")}
          />

          <Text style={styles.section}>{t("ttl.my_subscription")}</Text>
          <Text style={styles.value}>{validity}</Text>
          <AppButton
            label={
              /nerd/i.test(plan?.name ?? "") ? t("lbl.cancel_subscription") : t("prof.manage_subscription")
            }
            onPress={() => router.push("/choose-plan")}
          />

          <Text style={styles.label}>{t("ttl.id_document")}</Text>
          <Text style={styles.value}>{statusLabel(profile.id_document_status)}</Text>
          {!profile.id_document_url && (
            <AppButton label={uploading ? "Envoi..." : "Envoyer ma pièce"} onPress={pickDocument} />
          )}
          {profile.id_document_url && profile.id_document_status !== "verified" && (
            <AppButton label={t("lbl.send_document")} onPress={pickDocument} />
          )}
          {profile.id_document_url && <AppButton label={t("lbl.view_document")} onPress={viewDocument} />}

          <AppButton label={t("lbl.delete_account")} onPress={handleDelete} />
        </View>

        <AppButton label={t("lbl.logout")} onPress={doLogout} />
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  notifCard: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  notifTitle: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
  },
  notifMessage: {
    color: "#ccc",
    fontSize: 13,
    marginBottom: 4,
  },
  notifDate: {
    color: "#888",
    fontSize: 11,
  },
  input: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    backgroundColor: "#000",
  },
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 12 },
  title: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 28,
    color: "#fff",
    letterSpacing: 1,
    textAlign: "center",
  },
  headerRow: { flexDirection: "row", alignItems: "center", paddingBottom: 0 },
  headerSide: { flex: 1 },
  headerSideRight: { alignItems: "flex-end" },
  planBadge: {
    color: "#000",
    backgroundColor: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  section: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 17,
    color: "#ff2bd6",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 1,
  },
  bigCard: {
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 12,
    padding: 16,
    gap: 4,
    backgroundColor: "#000",
  },
  card: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 8,
    backgroundColor: "#000",
  },
  label: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 10,
    color: "#8e8e93",
    letterSpacing: 1,
  },
  value: { color: "#fff", fontSize: 15, marginBottom: 8 },
  line: { color: "#fff", fontSize: 13, fontStyle: "italic" },
  resCard: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: "#000",
  },
  resStatus: {
    color: "#ffd700",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4,
  },
  resActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  resPayBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  resPayText: { color: "#ff2bd6", fontWeight: "bold", fontStyle: "italic", fontSize: 12 },
  resCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#666",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  resCancelText: { color: "#8e8e93", fontWeight: "bold", fontStyle: "italic", fontSize: 12 },

  empty: { color: "#8e8e93", fontStyle: "italic" },
  row: { flexDirection: "row", gap: 8 },
});
