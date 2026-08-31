import { useEffect, useState } from "react";
import {
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import BackButton from "../components/BackButton";

export default function NewsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [role, setRole] = useState("client");
  const [fullscreen, setFullscreen] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("news")
        .select("*")
        .order("created_at", { ascending: false });
      setItems(data ?? []);
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (uid) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", uid).single();
        setRole(p?.role ?? "client");
      }
    }
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Actualités</Text>
        {items.length === 0 && <Text style={styles.empty}>Aucune actualité.</Text>}
        {items.map((n) => (
          <View key={n.id} style={styles.card}>
            <Text style={styles.name}>{n.title}</Text>
            <Text style={styles.date}>{new Date(n.created_at).toLocaleDateString("fr-FR")}</Text>
            {n.image_url ? (
              <TouchableOpacity onPress={() => setFullscreen(n.image_url)}>
                <Image source={{ uri: n.image_url }} style={styles.img} resizeMode="contain" />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.body}>{n.body}</Text>
            {role !== "client" && (
              <AppButton label="Modifier" onPress={() => router.push(`/edit-news/${n.id}`)} />
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!fullscreen} transparent={false} onRequestClose={() => setFullscreen(null)}>
        <View style={styles.full}>
          <Image source={{ uri: fullscreen ?? "" }} style={styles.fullImg} resizeMode="contain" />
          <TouchableOpacity onPress={() => setFullscreen(null)} style={styles.close}>
            <Text style={styles.closeTxt}>_Fermer</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { padding: 24, gap: 12 },
  title: {
    textAlign: "center",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 26,
    color: "#fff",
    paddingBottom: 8,
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
    fontSize: 17,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    color: "#fff",
    letterSpacing: 1,
  },
  date: { color: "#8e8e93", fontSize: 12 },
  img: { width: "100%", height: 180, borderRadius: 10 },
  body: { color: "#fff", fontSize: 15, lineHeight: 22 },
  full: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  fullImg: { width: "100%", height: "90%" },
  close: { position: "absolute", bottom: 40 },
  closeTxt: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 18,
    letterSpacing: 1,
  },
});
