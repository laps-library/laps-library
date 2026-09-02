import { useLang } from "../lib/i18n";
import { Pressable, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
export default function BackButton() {
  const { t } = useLang();
  return (
    <Pressable style={styles.btn} onPress={() => router.back()}>
      {({ pressed }) => <Text style={[styles.txt, pressed && { color: "#C0C0C0" }]}>{t("ttl.back_2")}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 10, paddingHorizontal: 24, alignSelf: "flex-start" },
  txt: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 14,
    letterSpacing: 1,
    color: "#fff",
  },
});
