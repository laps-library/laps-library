import { useLang } from "../lib/i18n";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Link, router } from "expo-router";
import { supabase } from "../lib/supabase";
import AppButton from "../components/AppButton";

export default function LoginScreen() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.replace("/home");
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Image source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />

          <TextInput
            style={styles.input}
            placeholder={t("plh.email")}
            placeholderTextColor="#8e8e93"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder={t("plh.password")}
            placeholderTextColor="#8e8e93"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <AppButton label={loading ? t("lbl.logging_in") : t("lbl.login_btn")} onPress={handleLogin} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("msg.no_account_yet")}</Text>
            <Link href="/register" style={styles.link}>
              {t("lbl.signup_link")}
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { padding: 24, gap: 12 },
  logo: { width: "100%", height: 200, alignSelf: "center", marginTop: 40, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#000",
    color: "#fff",
  },
  error: { color: "#fff", textAlign: "center" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 16, gap: 6 },
  footerText: { color: "#fff" },
  link: { color: "#fff", fontWeight: "bold", fontStyle: "italic", textTransform: "uppercase" },
});
