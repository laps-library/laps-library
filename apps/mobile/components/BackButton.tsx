import { Pressable, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function BackButton() {
  return (
    <Pressable style={styles.btn} onPress={() => router.back()}>
      {({ pressed }) => <Text style={[styles.txt, pressed && { color: "#C0C0C0" }]}>_Retour</Text>}
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
