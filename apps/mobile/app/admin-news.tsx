import { useLang } from "../lib/i18n";
import { useState } from "react";
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";
import BackButton from "../components/BackButton";

export default function AdminNewsScreen() {
  const { t, lang } = useLang();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function publish() {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Titre et contenu requis");
      return;
    }
    const { error } = await supabase
      .from("news")
      .insert({ title: title.trim(), body: body.trim(), title_en: titleEn.trim() || null, body_en: bodyEn.trim() || null, image_url: imageUrl });
    if (error) Alert.alert("Erreur", error.message);
    else {
      setTitle("");
      setBody("");
      setTitleEn("");
      setBodyEn("");
      setImageUrl(null);
      Alert.alert("Publié", "L'actualité est visible par tous les membres.");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("ttl.publish_news")}</Text>

        <Text style={styles.label}>{t("ttl.title")}</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder={t("plh.title")}
          placeholderTextColor="#8e8e93"
        />

        <Text style={styles.label}>{t("ttl.photo_optional")}</Text>
        <AppButton
          label={busy ? t("lbl.reading") : imageUrl ? t("lbl.change_photo") : t("lbl.add_photo")}
          onPress={pickImage}
        />
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="contain" />
        ) : null}

        <Text style={styles.label}>{t("ttl.content")}</Text>
        <TextInput
          style={[styles.input, styles.body]}
          value={body}
          onChangeText={setBody}
          placeholder={t("plh.content")}
          placeholderTextColor="#8e8e93"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <Text style={styles.label}>{t("ttl.title_en")}</Text>
        <TextInput
          style={styles.input}
          value={titleEn}
          onChangeText={setTitleEn}
          placeholder="Title (English)"
          placeholderTextColor="#8e8e93"
        />

        <Text style={styles.label}>{t("ttl.body_en")}</Text>
        <TextInput
          style={[styles.input, styles.body]}
          value={bodyEn}
          onChangeText={setBodyEn}
          placeholder="Body (English)"
          placeholderTextColor="#8e8e93"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        <AppButton label={t("lbl.publish")} onPress={publish} />
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
