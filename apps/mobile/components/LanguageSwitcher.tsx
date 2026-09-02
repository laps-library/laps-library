import { useLang } from "../lib/i18n";
import { Pressable, Text, View } from "react-native";
export default function LanguageSwitcher({ align = "center" }: { align?: "left" | "center" }) {
  const { lang, setLang, t } = useLang();
  return (
    <View style={{ flexDirection: "row", justifyContent: align === "left" ? "flex-start" : "center", gap: 10, paddingVertical: 0 }}>
      <Pressable
        onPress={() => setLang("fr")}
        style={{ borderWidth: 1, borderColor: lang === "fr" ? "#ff2bd6" : "#444", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 }}
      >
        <Text style={{ color: lang === "fr" ? "#ff2bd6" : "#8e8e93", fontWeight: "bold", fontStyle: "italic" }}>FR</Text>
      </Pressable>
      <Pressable
        onPress={() => setLang("en")}
        style={{ borderWidth: 1, borderColor: lang === "en" ? "#ff2bd6" : "#444", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 }}
      >
        <Text style={{ color: lang === "en" ? "#ff2bd6" : "#8e8e93", fontWeight: "bold", fontStyle: "italic" }}>EN</Text>
      </Pressable>
    </View>
  );
}
