import { useLang } from "../lib/i18n";
import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { supabase } from "../lib/supabase";
import BackButton from "../components/BackButton";
type Item = {
  id: string;
  name: string;
  brand: string;
  category: string;
  acquired: boolean;
  station: string;
};

export default function StationsScreen() {
  const { t } = useLang();
  const [all, setAll] = useState<Item[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("instrument_models")
        .select("id, name, brand, category, acquired, station")
        .not("station", "is", null)
        .order("station")
        .order("brand");
      setAll((data as Item[]) ?? []);
    }
    load();
  }, []);

  const stations = Array.from(new Set(all.map((i) => i.station))).sort();

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("ttl.inventory")}</Text>
        {stations.map((s) => {
          const items = all.filter((i) => i.station === s);
          const isOpen = !!open[s];
          return (
            <View key={s} style={styles.section}>
              <TouchableOpacity
                style={styles.header}
                onPress={() => setOpen((o) => ({ ...o, [s]: !o[s] }))}
              >
                <Text style={styles.headerText}>_{s}</Text>
                <Text style={styles.headerText}>
                  {items.length} {isOpen ? "-" : "+"}
                </Text>
              </TouchableOpacity>
              {isOpen &&
                items.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.cardBody}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.meta}>
                        {item.brand} · {item.category}
                      </Text>
                    </View>
                    <Text style={styles.badge}>{item.acquired ? "Acquis" : "À venir"}</Text>
                  </View>
                ))}
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
  scroll: { padding: 24, gap: 10 },
  title: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 26,
    color: "#fff",
    paddingBottom: 8,
    letterSpacing: 1,
  },
  section: { marginBottom: 8 },
  header: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#000",
  },
  headerText: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginLeft: 12,
    backgroundColor: "#000",
    alignItems: "center",
  },
  cardBody: { flex: 1, gap: 3 },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
    letterSpacing: 1,
  },
  meta: { color: "#fff", fontSize: 13 },
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
});
