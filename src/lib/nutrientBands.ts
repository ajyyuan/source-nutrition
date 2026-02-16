export type NutrientBandTone = {
  label: "Low signal" | "Medium signal" | "Strong signal";
  backgroundColor: string;
  textColor: string;
};

export const getNutrientBandTone = (percentDv: number): NutrientBandTone => {
  if (percentDv >= 0.8) {
    return {
      label: "Strong signal",
      backgroundColor: "#e7f6ec",
      textColor: "#176a35"
    };
  }
  if (percentDv >= 0.35) {
    return {
      label: "Medium signal",
      backgroundColor: "#fff6d6",
      textColor: "#8a6500"
    };
  }
  return {
    label: "Low signal",
    backgroundColor: "#f2f4f7",
    textColor: "#667085"
  };
};
