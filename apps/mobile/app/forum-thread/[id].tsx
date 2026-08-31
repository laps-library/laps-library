import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import AppButton from "../../components/AppButton";
import BackButton from "../../components/BackButton";

export default function ForumThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [thread, setThread] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const { data: t } = await supabase.from("forum_threads").select("*").eq("id", id).single();
    setThread(t);
    const { data: p } = await supabase
      .from("forum_posts")
      .select("*, profiles!forum_posts_created_by_fkey(pseudo, first_name, last_name)")
      .eq("thread_id", id)
      .order("created_at");
    setPosts(p ?? []);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function send() {
    if (!reply.trim()) return;
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase.from("forum_posts").insert({
      thread_id: id,
      body: reply.trim(),
      author_id: sess.session?.user.id,
      created_by: sess.session?.user.id,
    });
    if (error) {
      setMsg("Erreur : " + error.message);
      return;
    }
    setMsg("");
    setReply("");
    await load();
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{thread ? `_${thread.title}` : "_..."}</Text>

        {posts.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.meta}>
              {p.profiles?.pseudo || p.profiles?.first_name || "Membre"} ·{" "}
              {new Date(p.created_at).toLocaleDateString("fr-FR")}
            </Text>
            <Text style={styles.body}>{p.body || p.content}</Text>
          </View>
        ))}

        <Text style={styles.label}>_Répondre</Text>
        <TextInput
          style={[styles.input, styles.reply]}
          value={reply}
          onChangeText={setReply}
          placeholder="Ta réponse..."
          placeholderTextColor="#8e8e93"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <AppButton label="Envoyer" onPress={send} />
        {msg ? <Text style={styles.meta}>{msg}</Text> : null}
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
    fontSize: 24,
    color: "#fff",
    paddingBottom: 8,
    letterSpacing: 1,
  },
  label: {
    color: "#fff",
    marginTop: 8,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 12,
    padding: 14,
    gap: 6,
    backgroundColor: "#000",
  },
  meta: { color: "#8e8e93", fontSize: 12 },
  body: { color: "#fff", fontSize: 15, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    backgroundColor: "#000",
  },
  reply: { minHeight: 80 },
});
