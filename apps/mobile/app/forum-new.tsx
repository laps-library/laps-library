import { useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import BackButton from "../components/BackButton";

export default function ForumNewScreen() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function publish() {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Titre et message requis");
      return;
    }
    const { data: thread, error: e1 } = await supabase
      .from("forum_threads")
      .insert({ title: title.trim() })
      .select()
      .single();
    if (e1) {
      Alert.alert("Erreur", e1.message);
      return;
    }
    const { error: e2 } = await supabase
      .from("forum_posts")
      .insert({ thread_id: thread.id, body: body.trim() });
    if (e2) {
      Alert.alert("Erreur", e2.message);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Nouveau sujet</Text>

        <Text style={styles.label}>_Titre</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Titre du sujet"
          placeholderTextColor="#8e8e93"
        />

        <Text style={styles.label}>_Message</Text>
        <TextInput
          style={[styles.input, styles.body]}
          value={body}
          onChangeText={setBody}
          placeholder="Ton message..."
          placeholderTextColor="#8e8e93"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <AppButton label="Publier" onPress={publish} />
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
  label: {
    color: "#fff",
    marginTop: 8,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    backgroundColor: "#000",
  },
  body: { minHeight: 140 },
});
