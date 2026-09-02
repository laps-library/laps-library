import { useLang } from "../lib/i18n";
import { useEffect, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import BackButton from "../components/BackButton";

export default function AdminMediaScreen() {
  const { t } = useLang();
  const [all, setAll] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from("instrument_models")
      .select("id, name, brand, category, photo_url, manual_url")
      .order("category")
      .order("brand");
    setAll(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const list = all.filter((i) => (i.name + " " + i.brand).toLowerCase().includes(q.toLowerCase()));

  async function pickPhoto(item: any) {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets?.length) return;
    const uri = res.assets[0].uri;
    setBusy(item.id);
    try {
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const path = `${item.id}-photo.jpg`;
      const { error } = await supabase.storage
        .from("instrument-photos")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("instrument-photos").getPublicUrl(path);
      await supabase
        .from("instrument_models")
        .update({ photo_url: pub.publicUrl })
        .eq("id", item.id);
      Alert.alert("Photo mise à jour");
      load();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setBusy(null);
    }
  }

  async function pickPdf(item: any) {
    const res = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const file = res.assets[0];
    setBusy(item.id);
    try {
      const resp = await fetch(file.uri);
      const blob = await resp.blob();
      const path = `${item.id}-manual.pdf`;
      const { error } = await supabase.storage
        .from("instrument-manuals")
        .upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("instrument-manuals").getPublicUrl(path);
      await supabase
        .from("instrument_models")
        .update({ manual_url: pub.publicUrl })
        .eq("id", item.id);
      Alert.alert("Manuel mis à jour");
      load();
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("ttl.photos_manuals")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("plh.search")}
          placeholderTextColor="#8e8e93"
          value={q}
          onChangeText={setQ}
        />

        {list.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.brand} · {item.category}
            </Text>
            <View style={styles.row}>
              <AppButton
                label={item.photo_url ? "Photo ✓" : "Photo"}
                active={!!item.photo_url}
                onPress={() => pickPhoto(item)}
              />
              <AppButton
                label={item.manual_url ? "PDF ✓" : "PDF"}
                active={!!item.manual_url}
                onPress={() => pickPdf(item)}
              />
            </View>
            {busy === item.id && <Text style={styles.meta}>{t("msg.sending")}</Text>}
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
    paddingBottom: 8,
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    backgroundColor: "#000",
  },
  card: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    backgroundColor: "#000",
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
    letterSpacing: 1,
  },
  meta: { color: "#8e8e93", fontSize: 13 },
  row: { flexDirection: "row", gap: 16, marginTop: 6 },
});
