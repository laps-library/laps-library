import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  AppState,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LOCAL_PHOTOS } from "../assets/instruments/manifest";
import BackButton from "../components/BackButton";
import { supabase } from "../lib/supabase";
import { styles } from "../components/reserve/styles";
import { cleanKey, photoSource, stationPhotoSource, isAccessory } from "../lib/instrumentUtils";

function dateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  price_cents: number;
  billing_cycle: string | null;
  slot_price_cents: number;
  double_slot_price_cents: number;
  supervised_slot_price_cents: number;
  supervised_double_slot_price_cents: number;
  can_borrow: boolean;
  max_loans: number;
  loan_duration_days: number;
  loan_fee_cents: number;
  reservation_window_days: number;
  free_service_only: boolean;
  can_access_supervised: boolean;
  can_buy_prepaid_card: boolean;
  stripe_price_id: string | null;
  features: string | null;
  sort_order: number | null;
};

type Station = {
  id: string;
  name: string;
  brand: string | null;
  photo_url: string | null;
  package: string[] | null;
};

type Ws = {
  id: string;
  name: string;
};

type Slot = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
};

type SlotType = {
  id: string;
  code: string;
};

type Instr = {
  id: string;
  name: string;
  brand: string | null;
  photo_url: string | null;
};

type Pack = {
  id: string;
  slots_total: number;
  slots_remaining: number;
};

export default function ReserveScreen() {
  const [mode, setMode] = useState<null | "slot" | "loan" | "privat">(null);
  const [step, setStep] = useState(1);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedSubscriptionPlan, setSelectedSubscriptionPlan] = useState<Plan | null>(null);

  const [idStatus, setIdStatus] = useState<string>("");
  const [userId, setUserId] = useState("");

  const [stations, setStations] = useState<Station[]>([]);
  const [workstations, setWorkstations] = useState<Ws[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotTypes, setSlotTypes] = useState<SlotType[]>([]);
  const [instruments, setInstruments] = useState<Instr[]>([]);
  const [pack, setPack] = useState<Pack | null>(null);

  const [payWith, setPayWith] = useState<"pack" | "stripe">("pack");
  const [freeServiceInstruments, setFreeServiceInstruments] = useState<Instr[]>([]);
  const [fsListOpen, setFsListOpen] = useState(false);
  const [addPack, setAddPack] = useState<0 | 5 | 10>(0);

  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [supervised, setSupervised] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [stationId, setStationId] = useState("");
  const [wsId, setWsId] = useState("");

  const [weekStart, setWeekStart] = useState("");
  const [weeks, setWeeks] = useState(1);
  const [instrId, setInstrId] = useState("");
  const [privatDate, setPrivatDate] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const { data: sess } = await supabase.auth.getSession();

    const uid = sess.session?.user.id ?? "";

    setUserId(uid);

    supabase.functions
      .invoke("verify_payment", {
        body: { user_id: uid },
      })
      .catch(() => {});

    const [
      { data: prof },
      { data: pk },
      { data: sl },
      { data: st },
      { data: sta },
      { data: ws },
      { data: ins },
      { data: fsi },
      { data: allPlans },
    ] = await Promise.all([
      supabase.from("profiles").select("plan_id, id_document_status").eq("id", uid).single(),

      supabase
        .from("slot_packs")
        .select("id, slots_total, slots_remaining")
        .eq("user_id", uid)
        .eq("payment_status", "paid")
        .gt("slots_remaining", 0)
        .order("created_at")
        .limit(1)
        .maybeSingle(),

      supabase.from("time_slots").select("*").order("start_time"),

      supabase.from("slot_types").select("*"),

      supabase
        .from("instrument_models")
        .select("id, name, brand, photo_url, package")
        .eq("kind", "premium_station")
        .eq("acquired", true)
        .order("sort_order"),

      supabase
        .from("workstations")
        .select("id, name")
        .eq("is_free_service", true)
        .eq("is_reservable", true)
        .eq("is_active", true)
        .order("sort_order"),

      supabase
        .from("instrument_models")
        .select("id, name, brand, photo_url")
        .eq("kind", "instrument")
        .eq("borrowable", true)
        .order("brand")
        .order("name"),

      supabase
        .from("instrument_models")
        .select("id, name, brand, photo_url")
        .eq("kind", "instrument")
        .eq("acquired", true)
        .or("access_type.eq.libre_service,access_type.is.null")
        .order("brand")
        .order("name"),

      supabase
        .from("plans")
        .select(
          "id, name, code, description, price_cents, billing_cycle, slot_price_cents, double_slot_price_cents, supervised_slot_price_cents, supervised_double_slot_price_cents, can_borrow, max_loans, loan_duration_days, loan_fee_cents, reservation_window_days, free_service_only, can_access_supervised, can_buy_prepaid_card, stripe_price_id, features, sort_order",
        )
        .in("code", ["normal", "unlimited"])
        .order("sort_order"),
    ]);

    setIdStatus(prof?.id_document_status ?? "");
    setPack(pk);
    setSlots(sl ?? []);
    setSlotTypes(st ?? []);
    setStations(sta ?? []);
    setWorkstations(ws ?? []);
    setInstruments(ins ?? []);
    setFreeServiceInstruments(fsi ?? []);
    setPlans((allPlans as Plan[]) ?? []);

    if (prof?.plan_id) {
      const { data: pl } = await supabase
        .from("plans")
        .select(
          "id, name, code, description, price_cents, billing_cycle, slot_price_cents, double_slot_price_cents, supervised_slot_price_cents, supervised_double_slot_price_cents, can_borrow, max_loans, loan_duration_days, loan_fee_cents, reservation_window_days, free_service_only, can_access_supervised, can_buy_prepaid_card, stripe_price_id, features, sort_order",
        )
        .eq("id", prof.plan_id)
        .single();

      setPlan(pl as Plan);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") load();
    });

    return () => sub.remove();
  }, []);

  const isFree = !!plan && plan.name.toLowerCase().includes("newbie");

  const isNerd = /nerd/i.test(plan?.name ?? "");

  const isPro = /pro|nerd/i.test(plan?.name ?? "");

  const idVerified = idStatus === "verified";

  const loanEnabled = !!plan && plan.can_borrow && !isFree && idVerified;

  const days = Array.from(
    {
      length: plan?.reservation_window_days ?? 7,
    },
    (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i + 1);
      return d;
    },
  );

  const privatDays = Array.from({ length: 90 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  }).filter((d) => d.getDay() === 0 || d.getDay() === 1);

  const weekOptions = Array.from({ length: 4 }, (_, i) => {
    const d = new Date();
    const day = d.getDay();
    const diff = (8 - day) % 7 || 7;

    d.setDate(d.getDate() + diff + i * 7);

    return d;
  });

  const slot = slots.find((s) => s.id === slotId);

  const isDouble = slot?.code === "slot_ab";

  const slotPrice = !plan
    ? 0
    : supervised
      ? isDouble
        ? plan.supervised_double_slot_price_cents
        : plan.supervised_slot_price_cents
      : isDouble
        ? plan.double_slot_price_cents
        : plan.slot_price_cents;

  const station = stations.find((s) => s.id === stationId);

  const ws = workstations.find((w) => w.id === wsId);

  const posteName = station ? station.name.replace("Poste Premium — ", "") : (ws?.name ?? "");

  const loanInstr = instruments.find((i) => i.id === instrId);

  const loanPrice = weeks === 2 ? 1500 : 1000;

  const proPlan = plans.find((p) => p.code === "normal" || p.name.toUpperCase() === "PRO") ?? null;

  const nerdPlan =
    plans.find((p) => p.code === "unlimited" || p.name.toUpperCase() === "NERD") ?? null;

  const addPackCents =
    !supervised && isPro ? (addPack === 5 ? 6250 : addPack === 10 ? 10000 : 0) : 0;

  const currentSlotTotal = slotPrice + addPackCents;

  const hasSubscriptionSelection = selectedSubscriptionPlan !== null;

  const selectedSubscriptionIsPro =
    selectedSubscriptionPlan?.code === "normal" ||
    selectedSubscriptionPlan?.name?.toUpperCase() === "PRO";

  async function payOnline(
    kind: string,
    ref: Record<string, string>,
    amount: number,
    label: string,
  ) {
    const redirectUrl = ExpoLinking.createURL("payment-success");

    const { data, error } = await supabase.functions.invoke("create_payment", {
      body: {
        user_id: userId,
        amount_cents: amount,
        label,
        kind,
        ...ref,
        redirect_url: redirectUrl,
      },
    });

    if (error || !(data as any)?.url) {
      setMsg("Erreur paiement : " + (error?.message ?? "url manquante"));
      return;
    }

    setMsg("Ouverture de Stripe…");

    await AsyncStorage.setItem("laps_pending_payment", "1");
    const result = await WebBrowser.openAuthSessionAsync((data as any).url, redirectUrl);

    if (result.type === "success") {
      router.replace("/payment-success");
    } else {
      setMsg("Paiement annulé ou non finalisé.");
    }
  }

  async function confirmSlot() {
    const st = slotTypes.find((t) => (supervised ? t.code === "supervised" : t.code === "normal"));

    const usePack =
      !supervised && addPackCents === 0 && payWith === "pack" && !!pack && pack.slots_remaining > 0;

    const payNow = !supervised && slotPrice > 0 && !usePack;

    if (hasSubscriptionSelection) {
      const subscriptionPlan = selectedSubscriptionPlan;

      if (!subscriptionPlan) {
        return;
      }

      const upsellSlotPrice = supervised
        ? isDouble
          ? subscriptionPlan.supervised_double_slot_price_cents
          : subscriptionPlan.supervised_slot_price_cents
        : isDouble
          ? subscriptionPlan.double_slot_price_cents
          : subscriptionPlan.slot_price_cents;

      const { data, error } = await supabase
        .from("reservations")
        .insert({
          user_id: userId,
          workstation_id: wsId || null,
          station_id: stationId || null,
          slot_type_id: st?.id,
          time_slot_id: slotId,
          reservation_date: date,
          start_time: slot?.start_time,
          end_time: slot?.end_time,
          is_double_slot: isDouble,
          status: "pending_payment",
          price_cents: upsellSlotPrice,
          amount_cents: subscriptionPlan.price_cents + upsellSlotPrice,
          payment_method: "stripe",
          payment_status: "unpaid",
        })
        .select()
        .single();

      if (error) {
        setMsg("Erreur : " + error.message);
        return;
      }

      setMsg(`Redirection vers l'adhésion ${subscriptionPlan.name}…`);

      const redirectUrl = ExpoLinking.createURL("payment-success");
      const { data: checkData, error: checkErr } = await supabase.functions.invoke(
        "create_checkout",
        {
          body: {
            plan_id: subscriptionPlan.id,
            user_id: userId,
            redirect_url: redirectUrl,
            one_time_amount: upsellSlotPrice,
            reservation_id: data.id,
          },
        },
      );

      if (checkErr || !(checkData as any)?.url) {
        setMsg("Erreur paiement : " + (checkErr?.message ?? "url manquante"));
        return;
      }

      await AsyncStorage.setItem("laps_pending_payment", "1");
      const result = await WebBrowser.openAuthSessionAsync((checkData as any).url, redirectUrl);

      if (result.type === "success") {
        router.replace("/payment-success");
      } else {
        setMsg("Paiement annulé ou non finalisé.");
      }

      return;
    }

    if (usePack && pack) {
      const slotsToDeduct = isDouble ? 2 : 1;

      if (pack.slots_remaining < slotsToDeduct) {
        setMsg(
          "Carte insuffisante : il te faut " +
            slotsToDeduct +
            " créneau(x), il t’en reste " +
            pack.slots_remaining +
            ".",
        );
        return;
      }

      const { error: pe } = await supabase
        .from("slot_packs")
        .update({
          slots_remaining: pack.slots_remaining - slotsToDeduct,
        })
        .eq("id", pack.id);

      if (pe) {
        setMsg("Erreur carte : " + pe.message);
        return;
      }

      setPack({
        ...pack,
        slots_remaining: pack.slots_remaining - slotsToDeduct,
      });
    }

    let bundlePackId = "";

    if (addPackCents > 0) {
      const { data: pk, error: pke } = await supabase
        .from("slot_packs")
        .insert({
          user_id: userId,
          slots_total: addPack,
          slots_remaining: addPack,
          amount_cents: addPackCents,
          payment_status: "pending_payment",
        })
        .select()
        .single();

      if (pke || !pk) {
        setMsg("Erreur carte : " + (pke?.message ?? "création"));
        return;
      }

      bundlePackId = pk.id;
    }

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        user_id: userId,
        workstation_id: wsId || null,
        station_id: stationId || null,
        slot_type_id: st?.id,
        time_slot_id: slotId,
        reservation_date: date,
        start_time: slot?.start_time,
        end_time: slot?.end_time,
        is_double_slot: isDouble,
        status: supervised ? "pending_validation" : payNow ? "pending_payment" : "confirmed",
        price_cents: slotPrice,
        amount_cents: slotPrice + addPackCents,
        payment_method: usePack ? "pack" : payNow ? "stripe" : "on_site",
        payment_status: usePack ? "paid" : "unpaid",
      })
      .select()
      .single();

    if (error) {
      setMsg("Erreur : " + error.message);
      return;
    }

    if (payNow) {
      setMsg("Redirection vers le paiement…");

      if (bundlePackId) {
        await payOnline(
          "slot_bundle",
          {
            reservation_id: data.id,
            pack_id: bundlePackId,
          },
          slotPrice + addPackCents,
          "Créneau + carte créneaux LAPS",
        );
      } else {
        await payOnline(
          "reservation",
          {
            reservation_id: data.id,
          },
          slotPrice,
          "Créneau LAPS Library",
        );
      }
    } else {
      try {
        await supabase.functions.invoke("booking_email", {
          body: {
            reservation_id: data.id,
          },
        });

        setMsg("📧 Mail envoyé !");
      } catch (e) {
        setMsg("❌ Mail erreur : " + (e as any)?.message);
      }

      setMsg(
        supervised
          ? "✅ Réservation enregistrée ! En attente de validation LAPS."
          : "✅ Réservation enregistrée !",
      );
    }
  }

  async function confirmLoan() {
    // 1. Trouver une unité physique disponible du modèle demandé
    const { data: unit, error: unitErr } = await supabase
      .from("physical_units")
      .select("id")
      .eq("instrument_model_id", instrId)
      .eq("is_borrowable", true)
      .eq("status", "available")
      .limit(1)
      .maybeSingle();

    if (unitErr || !unit) {
      setMsg("Aucune unité disponible pour cet instrument.");
      return;
    }

    // 2. Créer le prêt avec l'unité physique
    const now = new Date().toISOString();
    const dueAt = new Date(Date.now() + (weeks || 1) * 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("loans")
      .insert({
        user_id: userId,
        physical_unit_id: unit.id,
        start_date: weekStart,
        duration_weeks: weeks,
        price_cents: loanPrice,
        amount_cents: loanPrice,
        status: "active",
        started_at: now,
        due_at: dueAt,
        fee_cents: 0,
      })
      .select()
      .single();

    if (error) {
      setMsg("Erreur : " + error.message);
      return;
    }

    setMsg("Redirection vers le paiement…");

    await payOnline(
      "loan",
      {
        loan_id: data.id,
      },
      loanPrice,
      "Emprunt " + (loanInstr?.name ?? ""),
    );
  }

  async function confirmPrivat() {
    const { data, error } = await supabase
      .from("privatizations")
      .insert({
        user_id: userId,
        privat_date: privatDate,
        amount_cents: 44000,
        status: "pending_payment",
      })
      .select()
      .single();

    if (error) {
      setMsg("Erreur : " + error.message);
      return;
    }

    setMsg("Redirection vers le paiement…");

    await payOnline(
      "privatization",
      {
        privatization_id: data.id,
      },
      44000,
      "Privatisation LAPS Library",
    );
  }

  function cta(label: string, enabled: boolean, onPress: () => void) {
    return (
      <TouchableOpacity
        style={[styles.cta, !enabled && styles.ctaDisabled]}
        onPress={onPress}
        disabled={!enabled}
      >
        <Text style={[styles.ctaText, !enabled && styles.ctaTextDisabled]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  function renderPlanFeature(feature: string) {
    return (
      <Text key={feature} style={styles.planFeature}>
        {feature}
      </Text>
    );
  }

  function renderSubscriptionCard(subscriptionPlan: Plan, highlighted: boolean) {
    const features = subscriptionPlan.features
      ? subscriptionPlan.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean)
      : [];

    const isSelected = selectedSubscriptionPlan?.id === subscriptionPlan.id;

    const isPro =
      subscriptionPlan.code === "normal" || subscriptionPlan.name.toUpperCase() === "PRO";

    return (
      <TouchableOpacity
        key={subscriptionPlan.id}
        style={[
          styles.planCard,
          highlighted && styles.planCardHighlighted,
          isSelected && styles.planCardSelected,
        ]}
        onPress={() => setSelectedSubscriptionPlan(isSelected ? null : subscriptionPlan)}
        activeOpacity={0.85}
      >
        <View style={styles.planCardHeader}>
          <View style={styles.planCardTitleBox}>
            <Text style={styles.planCardTitle}>_{subscriptionPlan.name}</Text>

            <Text style={styles.planCardSubtitle}>
              {isPro ? "L'accès complet à LAPS" : "La formule illimitée"}
            </Text>
          </View>

          <View style={styles.planPriceBox}>
            <Text style={styles.planPrice}>{subscriptionPlan.price_cents / 100}€</Text>

            <Text style={styles.planPeriod}>
              {subscriptionPlan.billing_cycle === "monthly" ? "/ mois" : "/ an"}
            </Text>
          </View>
        </View>

        {isPro ? (
          <Text style={styles.planPitch}>
            Passe à PRO pour profiter pleinement du studio : postes premium, emprunt d'instrument et
            cartes de créneaux prépayées.
          </Text>
        ) : (
          <Text style={styles.planPitch}>
            Passe à NERD pour accéder à la bibliothèque sans limite et réserver plus longtemps, avec
            les créneaux normaux gratuits.
          </Text>
        )}

        <View style={styles.planFeatures}>{features.map(renderPlanFeature)}</View>

        {isSelected && (
          <View style={styles.planSelectedBadge}>
            <Text style={styles.planSelectedBadgeText}>FORMULE SÉLECTIONNÉE</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />

      <ScrollView contentContainerStyle={styles.scroll}>
        {mode === null && (
          <View style={styles.stepBox}>
            <Text style={styles.stepLabel}>_Que veux-tu faire ?</Text>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => {
                setMode("privat");
                setStep(1);
              }}
            >
              <Text style={styles.optionTitle}>_Réserver la bibliothèque</Text>

              <Text style={styles.optionSub}>
                Correspond à l'ensemble des postes et le lieu de résidence réservés sur une plage
                étendue le dimanche uniquement.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => {
                setMode("slot");
                setStep(1);
                setSelectedSubscriptionPlan(null);
              }}
            >
              <Text style={styles.optionTitle}>_Réserver un créneau</Text>

              <Text style={styles.optionSub}>
                Simple, double ou supervisé, premium ou libre service
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionCard, !loanEnabled && styles.optionDisabled]}
              onPress={() => {
                if (loanEnabled) {
                  setMode("loan");
                  setStep(1);
                }
              }}
            >
              <Text style={[styles.optionTitle, !loanEnabled && styles.optionTextDisabled]}>
                _Réserver l'emprunt d'un instrument
              </Text>

              <Text style={[styles.optionSub, !loanEnabled && styles.optionTextDisabled]}>
                Repartez chez vous avec une nouvelle machine
              </Text>
            </TouchableOpacity>

            {isFree && (
              <Text style={styles.terms}>
                _Ta formule Newbie ne permet pas l'emprunt d'instrument.
              </Text>
            )}

            {isFree && (
              <Text style={styles.terms}>
                _Réserver un poste libre service vous donne la possibilité d'utiliser un poste
                premium, si et seulement si celui-ci n'est pas réservé ou utilisé lors de votre
                passage.
              </Text>
            )}

            {!isFree && !idVerified && (
              <Text style={styles.terms}>
                _Pièce d'identité à faire vérifier à partir de ton profil.
              </Text>
            )}
          </View>
        )}

        {mode === "slot" && step === 1 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setMode(null)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Étape 1/4 · {plan?.name}</Text>

            <Text style={styles.label}>_Choisis ton jour</Text>

            <View style={styles.chips}>
              {days.map((d) => {
                const ds = dateStr(d);

                return (
                  <TouchableOpacity
                    key={ds}
                    style={[styles.chip, date === ds && styles.chipActive]}
                    onPress={() => setDate(ds)}
                  >
                    <Text style={[styles.chipText, date === ds && styles.chipTextActive]}>
                      {d.toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {cta("Continuer", !!date, () => setStep(2))}
          </View>
        )}

        {mode === "slot" && step === 2 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setStep(1)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Étape 2/4 · {plan?.name}</Text>

            <Text style={styles.label}>_Type de créneau</Text>

            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, !supervised && styles.chipActive]}
                onPress={() => setSupervised(false)}
              >
                <Text style={[styles.chipText, !supervised && styles.chipTextActive]}>Normal</Text>
              </TouchableOpacity>

              {plan?.can_access_supervised && (
                <TouchableOpacity
                  style={[styles.chip, supervised && styles.chipActive]}
                  onPress={() => setSupervised(true)}
                >
                  <Text style={[styles.chipText, supervised && styles.chipTextActive]}>
                    Supervisé
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>_Horaire</Text>

            <View style={styles.chips}>
              {slots.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.chip, slotId === s.id && styles.chipActive]}
                  onPress={() => setSlotId(s.id)}
                >
                  <Text style={[styles.chipText, slotId === s.id && styles.chipTextActive]}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {cta("Continuer", !!slotId, () => setStep(3))}
          </View>
        )}

        {mode === "slot" && step === 3 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setStep(2)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Étape 3/4 · {plan?.name}</Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                _Réserver un poste en particulier te garantit l'utilisation de ce poste. Tu pourras
                aussi utiliser l'intégralité des autres postes, sous réserve qu'ils soient
                disponibles.
              </Text>
            </View>

            <Text style={styles.label}>_Postes premium</Text>

            <View>
              {stations.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  disabled={!!plan?.free_service_only}
                  style={[
                    styles.stationRow,
                    stationId === s.id && styles.stationRowActive,
                    !!plan?.free_service_only && styles.stationRowDisabled,
                  ]}
                  onPress={() => {
                    setStationId(s.id);
                    setWsId("");
                  }}
                >
                  <View style={styles.stationRowBody}>
                    <Text
                      style={[
                        styles.stationRowName,
                        !!plan?.free_service_only && styles.stationRowTextDisabled,
                      ]}
                    >
                      {s.name}
                    </Text>

                    {(s.package ?? []).map((pk, idx) => (
                      <Text
                        key={idx}
                        style={[
                          styles.stationRowPack,
                          !isAccessory(pk) && styles.stationRowPackBold,
                          !!plan?.free_service_only && styles.stationRowTextDisabled,
                        ]}
                      >
                        _ {pk}
                      </Text>
                    ))}
                  </View>

                  {stationPhotoSource(s) ? (
                    <Image
                      source={stationPhotoSource(s)}
                      style={[
                        styles.stationRowPhoto,
                        !!plan?.free_service_only && styles.stationRowPhotoDisabled,
                      ]}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.stationRowPhoto, styles.stationPhotoEmpty]}>
                      <Text style={styles.photoLetter}>{s.brand?.[0]}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {plan?.free_service_only && (
              <Text style={styles.terms}>
                _Les postes premium ne sont pas accessibles avec ta formule.
              </Text>
            )}

            <Text style={styles.label}>_Postes libre service</Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoText}>_ Keystage 49 (MPE / MIDI 2.0 / Poly AT)</Text>

              <Text style={styles.infoText}>_ Interface SSL 18</Text>

              <Text style={styles.infoText}>_ Casque Shure SRH440A</Text>
            </View>

            <View style={styles.chips}>
              {workstations.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.chip, wsId === w.id && styles.chipActive]}
                  onPress={() => {
                    setWsId(w.id);
                    setStationId("");
                  }}
                >
                  <Text style={[styles.chipText, wsId === w.id && styles.chipTextActive]}>
                    {w.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => setFsListOpen(!fsListOpen)}
            >
              <Text style={styles.label}>_Instruments disponibles en libre service</Text>

              <Text style={styles.typeArrow}>{fsListOpen ? "▴" : "▾"}</Text>
            </TouchableOpacity>

            {fsListOpen && (
              <View style={styles.infoCard}>
                {freeServiceInstruments.length === 0 && (
                  <Text style={styles.infoText}>
                    _Aucun instrument en libre service pour le moment.
                  </Text>
                )}

                {freeServiceInstruments.map((i) => (
                  <Text key={i.id} style={styles.infoText}>
                    _ {i.brand} {i.name}
                  </Text>
                ))}
              </View>
            )}

            {cta("Continuer", !!stationId || !!wsId, () => {
              setSelectedSubscriptionPlan(null);
              setStep(4);
            })}
          </View>
        )}

        {mode === "slot" && step === 4 && (
          <View style={[styles.stepBox, styles.stepBoxGrow]}>
            <Text style={styles.backLink} onPress={() => setStep(3)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Étape 4/4 · Paiement</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.sumRow}>Formule : {plan?.name}</Text>

              <Text style={styles.sumRow}>
                Jour :{" "}
                {date
                  ? new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                    })
                  : "—"}
              </Text>

              <Text style={styles.sumRow}>
                Créneau : {slot?.name} ({slot?.start_time?.slice(0, 5)} –{" "}
                {slot?.end_time?.slice(0, 5)})
              </Text>

              <Text style={styles.sumRow}>Type : {supervised ? "Supervisé" : "Normal"}</Text>

              <Text style={styles.sumRow}>Poste : {posteName || "—"}</Text>

              {addPack > 0 && (
                <Text style={styles.sumRow}>Carte créneaux : {addPack} créneaux</Text>
              )}

              <Text style={styles.sumPrice}>
                Total :{" "}
                {hasSubscriptionSelection
                  ? ((selectedSubscriptionPlan?.price_cents ?? 0) / 100).toFixed(2)
                  : (currentSlotTotal / 100).toFixed(2)}
                €
              </Text>
            </View>

            <Text style={styles.terms}>
              _Annulation ou report possible jusqu'à 16 h avant le début du créneau.
            </Text>

            {supervised && (
              <Text style={styles.terms}>_Créneau supervisé soumis à validation par LAPS.</Text>
            )}

            {!hasSubscriptionSelection && (
              <Text style={styles.terms}>
                {supervised
                  ? "_Règlement sur place."
                  : payWith === "pack" && pack && slotPrice > 0
                    ? isDouble
                      ? "_2 créneaux seront décomptés de ta carte."
                      : "_1 créneau sera décompté de ta carte."
                    : slotPrice === 0
                      ? "_Règlement sur place."
                      : "_Paiement en ligne sécurisé (Stripe)."}
              </Text>
            )}

            {slotPrice > 0 && !hasSubscriptionSelection && (
              <View style={styles.paymentSection}>
                <Text style={styles.label}>_Moyen de paiement</Text>

                <View style={styles.chips}>
                  {pack && !supervised && addPack === 0 && (
                    <TouchableOpacity
                      style={[styles.chip, payWith === "pack" && styles.chipActive]}
                      onPress={() => setPayWith("pack")}
                    >
                      <Text style={[styles.chipText, payWith === "pack" && styles.chipTextActive]}>
                        Ma carte créneaux ({pack.slots_remaining})
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.chip,
                      (payWith === "stripe" || addPack > 0) && styles.chipActive,
                    ]}
                    onPress={() => setPayWith("stripe")}
                  >
                    <Text style={[styles.chipText, payWith === "stripe" && styles.chipTextActive]}>
                      Carte bancaire
                    </Text>
                  </TouchableOpacity>
                </View>

                {isPro && !supervised && (
                  <>
                    <Text style={styles.label}>_Ajouter une carte créneaux (PRO)</Text>

                    <View style={styles.chips}>
                      <TouchableOpacity
                        style={[styles.chip, addPack === 5 && styles.chipActive]}
                        onPress={() => setAddPack(addPack === 5 ? 0 : 5)}
                      >
                        <Text style={[styles.chipText, addPack === 5 && styles.chipTextActive]}>
                          + Carte 5 créneaux · 62,50 € (12,50 €/créneau)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.chip, addPack === 10 && styles.chipActive]}
                        onPress={() => setAddPack(addPack === 10 ? 0 : 10)}
                      >
                        <Text style={[styles.chipText, addPack === 10 && styles.chipTextActive]}>
                          + Carte 10 créneaux · 100 € (10 €/créneau)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}

            {!supervised && slotPrice > 0 && (
              <View style={styles.subscriptionSection}>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onPress={() => setSubsOpen(!subsOpen)}
                >
                  <Text style={styles.subscriptionTitle}>_ Et si tu prenais ton abonnement ?</Text>
                  <Text
                    style={{
                      color: "#fff",
                      fontSize: 30,
                      fontWeight: "bold",
                      marginLeft: 10,
                    }}
                  >
                    {subsOpen ? "▴" : "▾"}
                  </Text>
                </TouchableOpacity>

                {(subsOpen || hasSubscriptionSelection) && (
                  <>
                    {proPlan &&
                      !/pro/i.test(plan?.name ?? "") &&
                      renderSubscriptionCard(proPlan, true)}

                    {nerdPlan &&
                      !/nerd/i.test(plan?.name ?? "") &&
                      renderSubscriptionCard(nerdPlan, false)}
                  </>
                )}

                {hasSubscriptionSelection && (
                  <TouchableOpacity
                    style={styles.keepCurrentButton}
                    onPress={() => setSelectedSubscriptionPlan(null)}
                  >
                    <Text style={styles.keepCurrentButtonText}>← Payer uniquement le créneau</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {hasSubscriptionSelection && (
              <View style={styles.subscriptionSummary}>
                <Text style={styles.subscriptionSummaryTitle}>
                  _Tu as choisi la formule {selectedSubscriptionPlan?.name}
                </Text>

                <Text style={styles.subscriptionSummaryText}>
                  Le paiement lancera l'adhésion à la formule {selectedSubscriptionPlan?.name}. Le
                  créneau sera associé à cette adhésion.
                </Text>

                {selectedSubscriptionIsPro ? (
                  <Text style={styles.subscriptionSummaryHighlight}>
                    50 €/an · Créneaux à 15 € · emprunt 1 semaine · postes premium · carte prépayée
                  </Text>
                ) : (
                  <Text style={styles.subscriptionSummaryHighlight}>
                    20 €/mois · créneaux normaux gratuits · accès illimité · emprunt 2 semaines ·
                    réservation jusqu'à 2 semaines à l'avance
                  </Text>
                )}
              </View>
            )}

            <View style={styles.flexSpacer} />

            {cta(
              hasSubscriptionSelection
                ? `Adhérer à ${selectedSubscriptionPlan?.name} et payer`
                : supervised
                  ? "Réserver en attente de confirmation"
                  : "Confirmer et payer",
              !!date && !!slotId && (!!stationId || !!wsId),
              confirmSlot,
            )}

            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          </View>
        )}

        {mode === "loan" && step === 1 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setMode(null)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Étape 1/3 · Semaine de départ</Text>

            <Text style={styles.label}>_Choisis ta semaine</Text>

            <View style={styles.chips}>
              {weekOptions.map((d) => {
                const ds = dateStr(d);

                return (
                  <TouchableOpacity
                    key={ds}
                    style={[styles.chip, weekStart === ds && styles.chipActive]}
                    onPress={() => setWeekStart(ds)}
                  >
                    <Text style={[styles.chipText, weekStart === ds && styles.chipTextActive]}>
                      Sem. du{" "}
                      {d.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {cta("Continuer", !!weekStart, () => setStep(2))}
          </View>
        )}

        {mode === "loan" && step === 2 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setStep(1)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Étape 2/3 · Durée</Text>

            <Text style={styles.label}>_Durée d'emprunt</Text>

            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.chip, weeks === 1 && styles.chipActive]}
                onPress={() => setWeeks(1)}
              >
                <Text style={[styles.chipText, weeks === 1 && styles.chipTextActive]}>
                  1 semaine · 10€
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chip,
                  isNerd && weeks === 2 && styles.chipActive,
                  !isNerd && styles.chipDisabled,
                ]}
                onPress={() => {
                  if (isNerd) setWeeks(2);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    isNerd && weeks === 2 && styles.chipTextActive,
                    !isNerd && styles.chipTextDisabled,
                  ]}
                >
                  2 semaines · 15€
                </Text>
              </TouchableOpacity>

              {!isNerd && (
                <Text style={styles.terms}>_2 semaines : réservé aux formules NERD.</Text>
              )}
            </View>

            {cta("Continuer", true, () => setStep(3))}
          </View>
        )}

        {mode === "loan" && step === 3 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setStep(2)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Étape 3/3 · Instrument</Text>

            <View style={styles.stationGrid}>
              {instruments.map((i) => (
                <TouchableOpacity
                  key={i.id}
                  style={[styles.stationTile, instrId === i.id && styles.stationTileActive]}
                  onPress={() => setInstrId(i.id)}
                >
                  {photoSource(i) ? (
                    <Image
                      source={photoSource(i)}
                      style={styles.stationPhoto}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.stationPhoto, styles.stationPhotoEmpty]}>
                      <Text style={styles.photoLetter}>{i.brand?.[0]}</Text>
                    </View>
                  )}

                  <Text style={styles.stationName} numberOfLines={2}>
                    {i.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {cta("Continuer", !!instrId, () => setStep(4))}
          </View>
        )}

        {mode === "loan" && step === 4 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setStep(3)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Récapitulatif</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.sumRow}>Formule : {plan?.name}</Text>

              <Text style={styles.sumRow}>
                Départ : semaine du{" "}
                {weekStart
                  ? new Date(weekStart + "T12:00:00").toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                    })
                  : "—"}
              </Text>

              <Text style={styles.sumRow}>
                Durée : {weeks} semaine
                {weeks > 1 ? "s" : ""}
              </Text>

              <Text style={styles.sumRow}>Instrument : {loanInstr?.name ?? "—"}</Text>

              <Text style={styles.sumPrice}>Prix : {loanPrice / 100}€</Text>
            </View>

            <Text style={styles.terms}>
              _Retour de l'instrument au studio à la fin de la période.
            </Text>

            <Text style={styles.terms}>_Paiement en ligne sécurisé (Stripe).</Text>

            {cta("Confirmer et payer", !!weekStart && !!instrId, confirmLoan)}

            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          </View>
        )}

        {mode === "privat" && step === 1 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setMode(null)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Privatisation · Choisis ton jour</Text>

            <View style={styles.chips}>
              {privatDays.map((d) => {
                const ds = dateStr(d);

                return (
                  <TouchableOpacity
                    key={ds}
                    style={[styles.chip, privatDate === ds && styles.chipActive]}
                    onPress={() => setPrivatDate(ds)}
                  >
                    <Text style={[styles.chipText, privatDate === ds && styles.chipTextActive]}>
                      {d.toLocaleDateString("fr-FR", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {cta("Continuer", !!privatDate, () => setStep(2))}
          </View>
        )}

        {mode === "privat" && step === 2 && (
          <View style={styles.stepBox}>
            <Text style={styles.backLink} onPress={() => setStep(1)}>
              _Retour
            </Text>

            <Text style={styles.stepLabel}>_Récapitulatif privatisation</Text>

            <View style={styles.summaryCard}>
              <Text style={styles.sumRow}>
                Jour :{" "}
                {privatDate
                  ? new Date(privatDate + "T12:00:00").toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                    })
                  : "—"}
              </Text>

              <Text style={styles.sumRow}>Lieu : LAPS Library (studio complet)</Text>

              <Text style={styles.sumPrice}>Prix : 440€</Text>
            </View>

            <Text style={styles.terms}>_Studio entier, matériel inclus, de 9 h à 23 h.</Text>

            <Text style={styles.terms}>_Paiement en ligne sécurisé (Stripe).</Text>

            {cta("Confirmer et payer", !!privatDate, confirmPrivat)}

            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          </View>
        )}
      </ScrollView>

      <StatusBar style="light" />
    </SafeAreaView>
  );
}
