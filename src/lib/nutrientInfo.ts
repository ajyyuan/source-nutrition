/**
 * Short descriptions and deficiency info for each tracked nutrient.
 * Sourced from NIH Office of Dietary Supplements and similar authorities.
 */

export type NutrientInfo = {
  description: string;
  deficiency: string;
};

export const NUTRIENT_INFO: Record<string, NutrientInfo> = {
  vitamin_a_ug: {
    description:
      "Vitamin A supports vision (especially night vision), immune function, reproduction, and growth. It keeps skin and mucous membranes healthy.",
    deficiency:
      "Deficiency can cause night blindness, dry eyes and skin, higher infection risk, and in severe cases blindness. Common in areas with limited access to animal foods or orange vegetables."
  },
  vitamin_c_mg: {
    description:
      "Vitamin C is an antioxidant that helps protect cells, supports the immune system, and is needed to make collagen (skin, bones, blood vessels). It also helps absorb iron from plant foods.",
    deficiency:
      "Deficiency leads to fatigue, weak immunity, slow wound healing, and in severe cases scurvy (bleeding gums, bruising, joint pain). Rare in developed countries but can occur with very low fruit/vegetable intake."
  },
  vitamin_d_ug: {
    description:
      "Vitamin D helps the body absorb calcium and phosphorus for strong bones and teeth. It also supports immune function and muscle health. The skin can make it from sunlight.",
    deficiency:
      "Deficiency can cause weak or soft bones (rickets in children, osteomalacia in adults), muscle weakness, and higher risk of falls. Common in northern latitudes, darker skin, older adults, and people who get little sun."
  },
  vitamin_e_mg: {
    description:
      "Vitamin E is an antioxidant that helps protect cells from damage. It supports immune function and helps keep skin and eyes healthy.",
    deficiency:
      "Deficiency is uncommon but can cause nerve and muscle damage, vision problems, and weakened immunity. More likely in conditions that impair fat absorption."
  },
  vitamin_k_ug: {
    description:
      "Vitamin K is essential for blood clotting and for building strong bones. We report total vitamin K (K1 phylloquinone + K2 menaquinones from food). Gut bacteria make some K2; dietary sources include leafy greens (K1), fermented foods and animal products (K2).",
    deficiency:
      "Deficiency can cause easy bruising and bleeding, heavy periods, and in severe cases internal bleeding. Newborns are at risk; adults on long-term antibiotics or with malabsorption may be affected."
  },
  thiamin_mg: {
    description:
      "Thiamin (B1) helps the body turn food into energy and is important for nerve and muscle function. It’s involved in glucose metabolism.",
    deficiency:
      "Deficiency can cause fatigue, irritability, nerve damage, and in severe cases beriberi (heart and nerve problems) or Wernicke–Korsakoff syndrome. Risk is higher with heavy alcohol use or very refined diets."
  },
  riboflavin_mg: {
    description:
      "Riboflavin (B2) helps produce energy from food and supports skin, eyes, and red blood cells. It also acts as an antioxidant.",
    deficiency:
      "Deficiency can cause cracked lips, sore throat, skin rashes, and anemia. Uncommon when eating a varied diet; risk is higher with very low dairy/eggs/meat and no fortified foods."
  },
  niacin_mg: {
    description:
      "Niacin (B3) is used in many reactions that turn food into energy. It supports the nervous system, skin, and digestive tract.",
    deficiency:
      "Deficiency can cause fatigue, headache, skin rash, and digestive issues. Severe deficiency leads to pellagra (dermatitis, diarrhea, dementia). Rare where diets include meat, fish, or fortified grains."
  },
  vitamin_b5_mg: {
    description:
      "Pantothenic acid (B5) is needed to make coenzyme A, which is involved in breaking down fats and building hormones and other compounds.",
    deficiency:
      "Deficiency is very rare because B5 is widespread in foods. When it occurs, it can cause numbness, fatigue, and digestive problems."
  },
  vitamin_b6_mg: {
    description:
      "Vitamin B6 helps the body use protein and make red blood cells and neurotransmitters. It also supports immune function.",
    deficiency:
      "Deficiency can cause anemia, skin rashes, cracked lips, and weakened immunity. More common in people with poor absorption or certain medications."
  },
  vitamin_b7_ug: {
    description:
      "Biotin (B7) helps the body turn food into energy and is involved in making fatty acids and some amino acids. It supports hair, skin, and nails.",
    deficiency:
      "Deficiency is rare; symptoms can include thinning hair, skin rash, and fatigue. Raw egg white (avidin) can block absorption if eaten in large amounts."
  },
  folate_ug: {
    description:
      "Folate (B9) is needed to make DNA and red blood cells. Adequate folate before and during early pregnancy helps reduce the risk of certain birth defects.",
    deficiency:
      "Deficiency can cause megaloblastic anemia, fatigue, and mouth sores. Pregnant people need enough folate to lower the risk of neural tube defects. Alcohol and some drugs can increase need or reduce absorption."
  },
  vitamin_b12_ug: {
    description:
      "Vitamin B12 is needed to make red blood cells and DNA and to keep nerves working properly. It’s found almost only in animal foods and fortified products.",
    deficiency:
      "Deficiency can cause anemia, fatigue, nerve damage (numbness, tingling), and mood changes. Vegans and people who don’t absorb B12 well (e.g. pernicious anemia, older adults) are at higher risk."
  },
  calcium_mg: {
    description:
      "Calcium is the main mineral in bones and teeth. It’s also needed for muscle contraction, nerve signaling, and blood clotting.",
    deficiency:
      "Low intake over time can lead to weak bones (osteoporosis) and higher fracture risk. Severe deficiency can cause muscle cramps and, in rare cases, heart rhythm problems. Many people get less than recommended."
  },
  iron_mg: {
    description:
      "Iron is part of hemoglobin, which carries oxygen in the blood. It’s also involved in energy production and immune function. Iron from meat (heme) is absorbed better than from plants (non-heme).",
    deficiency:
      "Deficiency can cause anemia (fatigue, weakness, pale skin), poor concentration, and reduced immunity. Common in women of childbearing age, young children, and people who eat little or no meat without balancing with iron-rich plants and vitamin C."
  },
  magnesium_mg: {
    description:
      "Magnesium is involved in hundreds of reactions: energy production, muscle and nerve function, blood sugar and blood pressure regulation, and bone health.",
    deficiency:
      "Deficiency can cause muscle cramps, fatigue, and irregular heartbeat. Many people get less than the recommended amount; risk is higher with digestive diseases or heavy alcohol use."
  },
  phosphorus_mg: {
    description:
      "Phosphorus is a major part of bones and teeth and is involved in making energy (ATP), cell membranes, and DNA.",
    deficiency:
      "Deficiency is uncommon because phosphorus is widespread. When it occurs (e.g. certain kidney conditions, refeeding), it can cause weak bones, fatigue, and appetite loss."
  },
  potassium_mg: {
    description:
      "Potassium helps maintain normal blood pressure, supports nerve and muscle function, and helps balance fluids and minerals in the body.",
    deficiency:
      "Low intake is common and is linked to higher blood pressure and stroke risk. Severe deficiency (often from losses, e.g. vomiting, diuretics) can cause weakness, cramps, and irregular heartbeat."
  },
  zinc_mg: {
    description:
      "Zinc supports immune function, wound healing, and the senses of taste and smell. It’s needed for growth and development and for making proteins and DNA.",
    deficiency:
      "Deficiency can cause weakened immunity, slow wound healing, hair loss, and skin changes. Common in regions where diets are low in meat or high in unrefined grains (phytates reduce absorption)."
  },
  selenium_ug: {
    description:
      "Selenium is part of antioxidant enzymes that protect cells. It supports thyroid function and the immune system.",
    deficiency:
      "Deficiency is rare in well-nourished populations but can cause hair loss, fatigue, and weakened immunity. Soil content varies, so intake depends on where food is grown or raised."
  },
  omega3_g: {
    description:
      "Omega-3 fatty acids (EPA, DHA, ALA) support heart and brain health, help reduce inflammation, and are important for eye and nerve development. Fatty fish are the main source of EPA and DHA.",
    deficiency:
      "Low intake is common. Very low omega-3 may be linked to dry skin, mood changes, and higher cardiovascular risk. Vegetarians get mostly ALA (e.g. flax, chia); conversion to EPA/DHA is limited."
  }
};
