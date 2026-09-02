import { Dimensions, StyleSheet } from "react-native";
const H = Dimensions.get("window").height;
const W = Dimensions.get("window").width;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  scroll: {
    padding: 24,
    gap: 12,
    flexGrow: 1,
  },

  title: {
    textAlign: "center",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 26,
    color: "#fff",
    letterSpacing: 1,
  },

  stepLabel: {
    color: "#8e8e93",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 1,
    textAlign: "center",
  },

  stepBox: {
    gap: 12,
  },

  soonBadge: {
    marginTop: 8,
    color: "#8e8e93",
    fontWeight: "bold",
    fontStyle: "italic",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },

  stepBoxGrow: {
    flex: 1,
  },

  flexSpacer: {
    flex: 1,
    minHeight: 20,
  },

  paymentSection: {
    marginTop: 24,
    gap: 12,
  },

  label: {
    color: "#ff2bd6",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 6,
  },

  backLink: {
    color: "#8e8e93",
    fontStyle: "italic",
  },

  optionCard: {
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 12,
    padding: 16,
    gap: 4,
    backgroundColor: "#000",
  },

  optionDisabled: {
    borderColor: "#333",
  },

  optionTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 16,
    letterSpacing: 1,
  },

  optionSub: {
    color: "#8e8e93",
    fontSize: 13,
    fontStyle: "italic",
  },

  optionTextDisabled: {
    color: "#555",
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#000",
  },

  chipActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },

  chipText: {
    color: "#8e8e93",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 1,
  },

  chipTextActive: {
    color: "#000",
  },

  chipDisabled: {
    borderColor: "#333",
  },

  chipTextDisabled: {
    color: "#555",
  },

  stationRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 8,
    backgroundColor: "#000",
  },

  stationRowActive: {
    borderColor: "#fff",
    borderWidth: 2,
  },

  stationRowDisabled: {
    opacity: 0.4,
  },

  stationRowTextDisabled: {
    color: "#555",
  },

  stationRowPhotoDisabled: {
    opacity: 0.5,
  },

  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },

  typeArrow: {
    color: "#fff",
    fontSize: 18,
    marginLeft: 10,
  },

  stationRowBody: {
    flex: 1,
    gap: 3,
  },

  stationRowName: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 15,
  },

  stationRowPack: {
    color: "#ff2bd6",
    fontSize: 12,
    fontStyle: "italic",
  },

  stationRowPackBold: {
    fontWeight: "bold",
  },

  stationRowPhoto: {
    width: 90,
    height: 90,
    borderRadius: 10,
  },

  stationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  stationTile: {
    width: "47%",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 12,
    padding: 8,
    gap: 6,
    alignItems: "center",
    backgroundColor: "#000",
  },

  stationTileActive: {
    borderColor: "#ff2bd6",
    borderWidth: 2,
  },

  stationPhoto: {
    width: "100%",
    height: 90,
  },

  stationPhotoEmpty: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },

  photoLetter: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    fontStyle: "italic",
  },

  stationName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: 1,
  },

  infoCard: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 14,
    gap: 5,
    backgroundColor: "#000",
  },

  infoText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
  },

  summaryCard: {
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 12,
    padding: 16,
    gap: 6,
    backgroundColor: "#000",
  },

  sumRow: {
    color: "#fff",
    fontSize: 15,
  },

  sumPrice: {
    color: "#ff2bd6",
    fontSize: 18,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 4,
  },

  terms: {
    color: "#8e8e93",
    fontStyle: "italic",
    fontSize: 13,
  },

  cta: {
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },

  ctaText: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
    paddingHorizontal: 10,
  },

  ctaDisabled: {
    backgroundColor: "#222",
  },

  ctaTextDisabled: {
    color: "#666",
  },

  msg: {
    color: "#ff2bd6",
    textAlign: "center",
    marginTop: 8,
  },

  /*
   * ============================
   * OFFRES PRO / NERD
   * ============================
   */

  subscriptionSection: {
    marginTop: 24,
    gap: 12,
  },

  subscriptionTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 18,
    letterSpacing: 0.8,
    lineHeight: 23,
  },

  subscriptionIntro: {
    color: "#8e8e93",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
    marginBottom: 4,
  },

  planCard: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 14,
    padding: 15,
    backgroundColor: "#000",
    gap: 12,
  },

  planCardHighlighted: {
    borderColor: "#ff2bd6",
  },

  planCardSelected: {
    borderColor: "#fff",
    borderWidth: 2,
    backgroundColor: "#0b0b0b",
  },

  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  planCardTitleBox: {
    flex: 1,
    gap: 3,
  },

  planCardTitle: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  planCardSubtitle: {
    color: "#ff2bd6",
    fontSize: 11,
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  planPriceBox: {
    alignItems: "flex-end",
  },

  planPrice: {
    color: "#fff",
    fontSize: 23,
    fontWeight: "bold",
    fontStyle: "italic",
  },

  planPeriod: {
    color: "#8e8e93",
    fontSize: 11,
    fontStyle: "italic",
  },

  planPitch: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
  },

  planFeatures: {
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: "#222",
    paddingTop: 10,
  },

  planFeature: {
    color: "#fff",
    fontSize: 12,
    lineHeight: 17,
  },

  planSelectedBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },

  planSelectedBadgeText: {
    color: "#ff2bd6",
    fontSize: 10,
    fontWeight: "bold",
    fontStyle: "italic",
    letterSpacing: 0.8,
  },

  keepCurrentButton: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  keepCurrentButtonText: {
    color: "#8e8e93",
    fontSize: 12,
    fontStyle: "italic",
    textDecorationLine: "underline",
  },

  subscriptionSummary: {
    borderWidth: 1,
    borderColor: "#ff2bd6",
    borderRadius: 12,
    padding: 14,
    gap: 7,
    backgroundColor: "#000",
  },

  subscriptionSummaryTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontStyle: "italic",
    textTransform: "uppercase",
    fontSize: 14,
    letterSpacing: 0.7,
  },

  subscriptionSummaryText: {
    color: "#8e8e93",
    fontSize: 12,
    lineHeight: 17,
  },

  subscriptionSummaryHighlight: {
    color: "#ff2bd6",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "bold",
    fontStyle: "italic",
  },
});
