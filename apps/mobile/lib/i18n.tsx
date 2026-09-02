import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translate } from "./translations";
import type { Lang } from "./translations";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string) => string };

const LanguageContext = createContext<Ctx>({
  lang: "fr",
  setLang: () => {},
  t: (k) => translate("fr", k),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    AsyncStorage.getItem("app_lang").then((v) => {
      if (v === "en" || v === "fr") setLangState(v);
    });
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    AsyncStorage.setItem("app_lang", l);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: (k) => translate(lang, k) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
