export type NutrientBandTone = {
  label: "Low signal" | "Medium signal" | "Strong signal";
  backgroundColor: string;
  textColor: string;
};

export const getNutrientBandTone = (percentDv: number): NutrientBandTone => {
  if (percentDv >= 1) {
    return {
      label: "Strong signal",
      backgroundColor: "#e6f4ea",
      textColor: "#1a7f37"
    };
  }
  if (percentDv >= 0.5) {
    return {
      label: "Medium signal",
      backgroundColor: "#fff4cc",
      textColor: "#7a5e00"
    };
  }
  return {
    label: "Low signal",
    backgroundColor: "#eef1f4",
    textColor: "#475467"
  };
};
