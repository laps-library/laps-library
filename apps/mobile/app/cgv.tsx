import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import BackButton from "../components/BackButton";

const SECTIONS: { t: string; c: string[] }[] = [
  {
    t: "1 · Objet",
    c: [
      "Les présentes Conditions Générales de Vente (CGV) régissent les abonnements et prestations vendus par LAPS Library via son application.",
      "Tout achat d'un abonnement ou d'une prestation implique l'acceptation sans réserve des présentes CGV.",
    ],
  },
  {
    t: "2 · Abonnements",
    c: [
      "LAPS Library propose deux abonnements payants : PRO et NERD, ainsi qu'une formule gratuite d'accès au libre service.",
      "Les abonnements sont facturés au mois ou à l'année selon le choix effectué lors de la souscription.",
      "L'abonnement prend effet immédiatement après confirmation du paiement.",
    ],
  },
  {
    t: "3 · Prix",
    c: [
      "Les prix sont indiqués en euros, toutes taxes comprises, sur l'écran « Gérer ma formule ».",
      "Le paiement s'effectue en ligne par carte bancaire via Stripe, ou sur place lorsque la prestation le prévoit.",
    ],
  },
  {
    t: "4 · Résiliation",
    c: [
      "L'abonné peut résilier à tout moment depuis l'application (« Gérer ma formule »).",
      "La résiliation prend effet immédiatement : l'accès aux avantages payants cesse et l'utilisateur revient à la formule gratuite.",
      "Aucun remboursement au prorata n'est effectué pour la période entamée.",
    ],
  },
  {
    t: "5 · Réservation de créneaux",
    c: [
      "Les créneaux se réservent depuis l'application, dans la limite de la fenêtre de réservation de la formule.",
      "Annulation ou report possible jusqu'à 16 h avant le début du créneau.",
      "Les créneaux supervisés sont soumis à validation par LAPS.",
      "Réserver un poste libre service donne la possibilité d'utiliser un poste premium si celui-ci n'est pas réservé ou utilisé. Réserver un poste premium spécifique n'empêche pas d'en utiliser un autre, sous réserve que celui-ci soit disponible.",
    ],
  },
  {
    t: "6 · Cartes créneaux (PRO)",
    c: [
      "Les abonnés PRO peuvent acheter des cartes prépayées : 5 créneaux (62,50 €, soit 12,50 €/créneau) ou 10 créneaux (100 €, soit 10 €/créneau).",
      "Les cartes sont valables sur les créneaux de 10 h à 15 h, décomptées d'un créneau par réservation.",
      "Les cartes ne sont ni remboursables ni transférables.",
    ],
  },
  {
    t: "7 · Emprunt d'instruments",
    c: [
      "L'emprunt est réservé aux formules payantes, après vérification d'une pièce d'identité.",
      "Durées : 1 ou 2 semaines selon la formule. Retour de l'instrument au studio à la fin de la période.",
      "Tout instrument rendu endommagé ou non rendu pourra faire l'objet d'une facturation au prix de remplacement.",
    ],
  },
  {
    t: "8 · Privatisation",
    c: [
      "La privatisation du lieu (440 €, dimanche et lundi, 9 h – 19 h) est ouverte à tous, réglée en ligne.",
      "Le règlement est confirmé à l'issue du paiement ; un report est possible jusqu'à 7 jours avant la date.",
    ],
  },
  {
    t: "9 · Rétractation",
    c: [
      "Conformément au Code de la consommation, le droit de rétractation de 14 jours s'applique aux abonnements, sauf si l'exécution du service a commencé avec l'accord du client.",
      "Les prestations de loisirs à date déterminée (créneaux, privatisation) ne bénéficient pas du droit de rétractation (art. L221-28).",
    ],
  },
  {
    t: "10 · Données personnelles",
    c: [
      "Les données collectées (identité, email, réservations, paiements) servent exclusivement à la gestion des services.",
      "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification et de suppression en écrivant à LAPS Library.",
    ],
  },
  {
    t: "11 · Réclamations",
    c: [
      "Toute réclamation s'effectue auprès de LAPS Library. À défaut d'accord, le consommateur peut recourir à un médiateur de la consommation.",
    ],
  },
];

export default function CgvScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>_CGV · Abonnements</Text>
        {SECTIONS.map((sec) => (
          <View key={sec.t} style={styles.block}>
            <Text style={styles.h}>{sec.t}</Text>
            {sec.c.map((line, i) => (
              <Text key={i} style={styles.p}>
                {line}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { padding: 24, gap: 16 },
  title: {
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 26,
    color: "#fff",
    letterSpacing: 1,
    textAlign: "center",
  },
  block: { gap: 6 },
  h: {
    color: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 14,
    letterSpacing: 1,
  },
  p: { color: "#8e8e93", fontSize: 13, lineHeight: 19 },
});
