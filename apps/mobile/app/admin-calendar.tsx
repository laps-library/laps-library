import { useLang } from "../lib/i18n";
import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import BackButton from "../components/BackButton";

const dstr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AdminCalendarScreen() {
  const { t } = useLang();
  const [week, setWeek] = useState(0);
  const [slots, setSlots] = useState<any[]>([]);
  const [capacity, setCapacity] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loanCounts, setLoanCounts] = useState<Record<string, number>>({});

  const start = new Date();
  start.setDate(start.getDate() + week * 7 - ((start.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    async function load() {
      const { data: ts } = await supabase
        .from("time_slots")
        .select("id, name, start_time")
        .order("start_time");
      setSlots(ts ?? []);
      const { count: cw } = await supabase
        .from("workstations")
        .select("*", { count: "exact", head: true });
      const { count: cs } = await supabase
        .from("instrument_models")
        .select("*", { count: "exact", head: true })
        .eq("kind", "premium_station");
      setCapacity((cw ?? 0) + (cs ?? 0));
      const a = dstr(days[0]);
      const b = dstr(days[6]);
      const { data: res } = await supabase
        .from("reservations")
        .select("reservation_date, time_slot_id")
        .neq("status", "cancelled")
        .gte("reservation_date", a)
        .lte("reservation_date", b);
      const m: Record<string, number> = {};
      for (const r of res ?? [])
        m[r.reservation_date + "|" + r.time_slot_id] =
          (m[r.reservation_date + "|" + r.time_slot_id] ?? 0) + 1;
      setCounts(m);

      // Emprunts chevauchant la semaine
      const { data: loans } = await supabase
        .from("loans")
        .select("*")
        .in("status", ["requested", "active"]);
      const loanM: Record<string, number> = {};
      for (const l of loans ?? []) {
        if (!l.start_date) continue;
        const s = new Date(l.start_date);
        const e = l.end_date ? new Date(l.end_date) : new Date(s);
        const from = s > new Date(a) ? s : new Date(a);
        const to = e < new Date(b) ? e : new Date(b);
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          const k = dstr(d);
          loanM[k] = (loanM[k] ?? 0) + 1;
        }
      }
      setLoanCounts(loanM);
    }
    load();
  }, [week]);

  function color(n: number) {
    if (n <= 0) return "#22c55e";
    if (n >= capacity) return "#ef4444";
    return "#f59e0b";
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("ttl.global_cal")}</Text>
        <View style={styles.nav}>
          <AppButton label={t("lbl.prev_week")} fontSize={12} onPress={() => setWeek(week - 1)} />
          <AppButton label={t("lbl.next_week")} fontSize={12} onPress={() => setWeek(week + 1)} />
        </View>
        <Text style={styles.range}>
          {dstr(days[0])} → {dstr(days[6])} · capacité {capacity} postes
        </Text>

        <Text style={styles.subTitle}>{t("ttl.onsite_slots")}</Text>
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: "#22c55e" }]} />
          <Text style={styles.legendTxt}>{t("msg.free")}</Text>
          <View style={[styles.dot, { backgroundColor: "#f59e0b" }]} />
          <Text style={styles.legendTxt}>{t("msg.partial")}</Text>
          <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
          <Text style={styles.legendTxt}>{t("msg.full")}</Text>
        </View>
        {days.map((d) => (
          <View key={dstr(d)} style={styles.day}>
            <Text style={styles.dayTitle}>
              _
              {d.toLocaleDateString("fr-FR", {
                weekday: "short",
                day: "2-digit",
                month: "2-digit",
              })}
            </Text>
            <View style={styles.cells}>
              {slots.map((s) => {
                const n = counts[dstr(d) + "|" + s.id] ?? 0;
                return (
                  <View key={s.id} style={[styles.cell, { borderColor: color(n) }]}>
                    <Text style={styles.cellName}>{s.name}</Text>
                    <Text style={[styles.cellCount, { color: color(n) }]}>
                      {n}/{capacity}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Text style={[styles.subTitle, { marginTop: 24 }]}>{t("ttl.instrument_loans")}</Text>
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: "#a855f7" }]} />
          <Text style={styles.legendTxt}>{t("msg.active_loans")}</Text>
        </View>
        {days.map((d) => {
          const n = loanCounts[dstr(d)] ?? 0;
          return (
            <View key={"loan-" + dstr(d)} style={styles.loanDay}>
              <Text style={styles.dayTitle}>
                _
                {d.toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </Text>
              <View style={[styles.loanCell, { borderColor: n > 0 ? "#a855f7" : "#333" }]}>
                <Text style={[styles.cellCount, { color: n > 0 ? "#a855f7" : "#666" }]}>
                  {n} emprunt{n > 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          );
        })}
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
  nav: { flexDirection: "row", gap: 8 },
  range: { color: "#8e8e93", fontStyle: "italic" },
  subTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#ff2bd6",
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 1,
  },
  legend: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendTxt: { color: "#8e8e93", fontSize: 12 },
  day: { marginBottom: 12 },
  dayTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  cells: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell: { borderWidth: 1, borderRadius: 8, padding: 8, minWidth: 90 },
  cellName: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  cellCount: { fontWeight: "bold", fontSize: 14 },
  loanDay: { marginBottom: 8 },
  loanCell: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#000",
    alignItems: "center",
  },
});
