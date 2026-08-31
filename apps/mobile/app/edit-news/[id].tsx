import { useEffect, useState } from "react";
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../../lib/supabase";
import AppButton from "../../components/AppButton";
import BackButton from "../../components/BackButton";

export default function EditNewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("news").select("*").eq("id", id).single();
      if (data) {
        setTitle(data.title);
        setBody(data.body);
        setImageUrl(data.image_url);
      }
      setLoaded(true);
    }
    load();
  }, [id]);

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.5,
      maxWidth: 1200,
      maxHeight: 1200,
    } as any);
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(res.assets[0].uri, { encoding: "base64" });
      setImageUrl(`data:image/jpeg;base64,${base64}`);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Titre et contenu requis");
      return;
    }
    const { error } = await supabase
      .from("news")
      .update({ title: title.trim(), body: body.trim(), image_url: imageUrl })
      .eq("id", id);
    if (error) Alert.alert("Erreur", error.message);
    else {
      Alert.alert("Enregistré");
      setTimeout(() => router.back(), 600);
    }
  }

  if (!loaded) return null;

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_Modifier l'actualité</Text>

        <Text style={styles.label}>_Titre</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Titre"
          placeholderTextColor="#8e8e93"
        />

        <Text style={styles.label}>_Photo</Text>
        <AppButton label={busy ? "Lecture..." : "Changer la photo"} onPress={pickImage} />
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="contain" />
        ) : null}

        <Text style={styles.label}>_Contenu</Text>
        <TextInput
          style={[styles.input, styles.body]}
          value={body}
          onChangeText={setBody}
          placeholder="Contenu..."
          placeholderTextColor="#8e8e93"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <AppButton label="Enregistrer" onPress={save} />
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
  preview: { width: "100%", height: 180, borderRadius: 10, borderWidth: 1, borderColor: "#fff" },
});
