import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import { AppButton } from "../lib/AppButton";
import { EmptyState } from "../lib/EmptyState";
import { formatConfidence, formatNutrientLabel } from "../lib/formatters";
import {
  addNutrientsFromFoodProfiles,
  computeMealTotalsAndInsights,
  NUTRIENT_DB_VERSION
} from "../lib/mealNutrients";
import { NutrientBarRow } from "../lib/NutrientBarRow";
import { supabase } from "../lib/supabase";
import { QUANTITY_UNITS, type QuantityUnit, toGrams } from "../lib/unitConversion";
import type { RootTabParamList } from "../navigation/AppNavigator";

const PHOTO_BUCKET = "meal-photos";

type ParsedItem = {
  name: string;
  estimated_grams: number;
  confidence: number;
  quantity?: number;
  unit?: QuantityUnit;
  last_precise_unit?: QuantityUnit;
  canonical_id?: string;
  canonical_name?: string;
};

type EditableItem = {
  id: string;
  name: string;
  quantity: number;
  quantityInput: string;
  unit: QuantityUnit;
  lastPreciseUnit: QuantityUnit;
  confidence: number;
  canonicalId: string | null;
  canonicalName: string | null;
};

type MappedItem = {
  name: string;
  canonical_id: string;
  canonical_name: string;
  confidence: number;
  grams: number;
  nutrient_totals: NutrientTotals | null;
};

type FoodSuggestion = {
  canonical_id: string;
  canonical_name: string;
  lexical_score: number;
};

const NUTRIENT_KEYS = [
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "vitamin_b5_mg",
  "vitamin_b6_mg",
  "vitamin_b7_ug",
  "folate_ug",
  "vitamin_b12_ug",
  "calcium_mg",
  "iron_mg",
  "magnesium_mg",
  "phosphorus_mg",
  "potassium_mg",
  "zinc_mg",
  "selenium_ug",
  "omega3_g"
] as const;

type NutrientVector = {
  vitamin_a_ug: number;
  vitamin_c_mg: number;
  vitamin_d_ug: number;
  vitamin_e_mg: number;
  vitamin_k_ug: number;
  thiamin_mg: number;
  riboflavin_mg: number;
  niacin_mg: number;
  vitamin_b5_mg: number;
  vitamin_b6_mg: number;
  vitamin_b7_ug: number;
  folate_ug: number;
  vitamin_b12_ug: number;
  calcium_mg: number;
  iron_mg: number;
  magnesium_mg: number;
  phosphorus_mg: number;
  potassium_mg: number;
  zinc_mg: number;
  selenium_ug: number;
  omega3_g: number;
};

type NutrientTotals = {
  totals: NutrientVector;
  percent_dv: NutrientVector;
};

const DAILY_VALUES: NutrientVector = {
  vitamin_a_ug: 900,
  vitamin_c_mg: 90,
  vitamin_d_ug: 20,
  vitamin_e_mg: 15,
  vitamin_k_ug: 120,
  thiamin_mg: 1.2,
  riboflavin_mg: 1.3,
  niacin_mg: 16,
  vitamin_b5_mg: 5,
  vitamin_b6_mg: 1.7,
  vitamin_b7_ug: 30,
  folate_ug: 400,
  vitamin_b12_ug: 2.4,
  calcium_mg: 1300,
  iron_mg: 18,
  magnesium_mg: 420,
  phosphorus_mg: 1250,
  potassium_mg: 4700,
  zinc_mg: 11,
  selenium_ug: 55,
  omega3_g: 1.6
};

type Props = BottomTabScreenProps<RootTabParamList, "Capture">;

const isQuantityUnit = (value: unknown): value is QuantityUnit =>
  typeof value === "string" && QUANTITY_UNITS.includes(value as QuantityUnit);

const parseVisionPayload = (payload: unknown): ParsedItem[] => {
  if (payload === null || payload === undefined || payload === "") {
    throw new Error("AI response was empty.");
  }
  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      throw new Error("AI response was not valid JSON.");
    }
  }
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "items" in parsed
      ? (parsed as { items: unknown }).items
      : null;

  if (!Array.isArray(items)) {
    throw new Error("AI response must include an items array.");
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Item ${index + 1} is not an object.`);
    }
    const candidate = item as Partial<ParsedItem>;
    const canonicalName =
      typeof candidate.canonical_name === "string" && candidate.canonical_name.trim()
        ? candidate.canonical_name.trim()
        : undefined;
    const fallbackName =
      typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim() : "";
    const resolvedName = canonicalName ?? fallbackName;
    if (!resolvedName) {
      throw new Error(`Item ${index + 1} is missing a name.`);
    }
    if (typeof candidate.estimated_grams !== "number" || Number.isNaN(candidate.estimated_grams)) {
      throw new Error(`Item ${index + 1} has invalid estimated_grams.`);
    }
    if (
      typeof candidate.confidence !== "number" ||
      Number.isNaN(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1
    ) {
      throw new Error(`Item ${index + 1} has invalid confidence.`);
    }

    return {
      name: resolvedName,
      estimated_grams: Math.max(candidate.estimated_grams, 0),
      confidence: candidate.confidence,
      canonical_id:
        typeof candidate.canonical_id === "string" && candidate.canonical_id.trim()
          ? candidate.canonical_id.trim()
          : undefined,
      canonical_name:
        typeof candidate.canonical_name === "string" && candidate.canonical_name.trim()
          ? candidate.canonical_name.trim()
          : undefined
    };
  });
};

const parseMappingPayload = (payload: unknown): MappedItem[] => {
  if (payload === null || payload === undefined || payload === "") {
    throw new Error("Mapping response was empty.");
  }
  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      throw new Error("Mapping response was not valid JSON.");
    }
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    "error" in parsed &&
    typeof (parsed as { error?: unknown }).error === "string" &&
    (parsed as { error: string }).error.trim().length > 0
  ) {
    throw new Error((parsed as { error: string }).error.trim());
  }
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "items" in parsed
      ? (parsed as { items: unknown }).items
      : null;

  if (!Array.isArray(items)) {
    throw new Error("Mapping response must include an items array.");
  }

  return items.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Mapping item ${index + 1} is not an object.`);
    }
    const candidate = item as Partial<MappedItem>;
    if (typeof candidate.name !== "string" || !candidate.name.trim()) {
      throw new Error(`Mapping item ${index + 1} is missing a name.`);
    }
    if (typeof candidate.canonical_id !== "string" || !candidate.canonical_id.trim()) {
      throw new Error(`Mapping item ${index + 1} is missing canonical_id.`);
    }
    if (typeof candidate.canonical_name !== "string" || !candidate.canonical_name.trim()) {
      throw new Error(`Mapping item ${index + 1} is missing canonical_name.`);
    }
    if (
      typeof candidate.confidence !== "number" ||
      Number.isNaN(candidate.confidence) ||
      candidate.confidence < 0 ||
      candidate.confidence > 1
    ) {
      throw new Error(`Mapping item ${index + 1} has invalid confidence.`);
    }

    return {
      name: candidate.name.trim(),
      canonical_id: candidate.canonical_id.trim(),
      canonical_name: candidate.canonical_name.trim(),
      confidence: candidate.confidence,
      grams:
        typeof candidate.grams === "number" && Number.isFinite(candidate.grams)
          ? Math.max(candidate.grams, 0)
          : 0,
      nutrient_totals: parseItemNutrientTotals(candidate.nutrient_totals)
    };
  });
};

const parseNutrientVector = (value: unknown): NutrientVector | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  return NUTRIENT_KEYS.reduce(
    (acc, key) => {
      const raw = candidate[key];
      acc[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      return acc;
    },
    {} as NutrientVector
  );
};

const parseItemNutrientTotals = (value: unknown): NutrientTotals | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as { totals?: unknown; percent_dv?: unknown };
  const totals = parseNutrientVector(candidate.totals);
  const percentDv = parseNutrientVector(candidate.percent_dv);
  if (!totals || !percentDv) {
    return null;
  }
  return {
    totals,
    percent_dv: percentDv
  };
};

const makeZeroNutrientVector = (): NutrientVector =>
  NUTRIENT_KEYS.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as NutrientVector
  );

const parseFoodSuggestions = (payload: unknown): FoodSuggestion[] => {
  if (payload === null || payload === undefined || payload === "") {
    return [];
  }
  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      return [];
    }
  }
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && "items" in parsed
      ? (parsed as { items: unknown }).items
      : null;
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => item as Partial<FoodSuggestion>)
    .filter(
      (item) =>
        typeof item.canonical_id === "string" &&
        item.canonical_id.trim().length > 0 &&
        typeof item.canonical_name === "string" &&
        item.canonical_name.trim().length > 0
    )
    .map((item) => ({
      canonical_id: item.canonical_id!.trim(),
      canonical_name: item.canonical_name!.trim(),
      lexical_score:
        typeof item.lexical_score === "number" && Number.isFinite(item.lexical_score)
          ? item.lexical_score
          : 0
    }));
};

const parseNutrientTotals = (payload: unknown): NutrientTotals | null => {
  if (payload === null || payload === undefined || payload === "") {
    return null;
  }
  let parsed: unknown = payload;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || !("nutrient_totals" in parsed)) {
    return null;
  }
  const totals = (parsed as { nutrient_totals?: NutrientTotals }).nutrient_totals;
  if (!totals || typeof totals !== "object") {
    return null;
  }
  return totals;
};

const formatQuantityInput = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?[1-9])0+$/, "$1");
};

const getConfidenceTone = (value: number) => {
  if (value >= 0.75) {
    return { backgroundColor: "#e6f4ea", textColor: "#1a7f37" };
  }
  if (value >= 0.5) {
    return { backgroundColor: "#fff4cc", textColor: "#7a5e00" };
  }
  return { backgroundColor: "#fce8e6", textColor: "#b42318" };
};

const renderConfidenceBadge = (value: number) => {
  const tone = getConfidenceTone(value);
  return (
    <View style={[styles.confidenceBadge, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.confidenceBadgeText, { color: tone.textColor }]}>
        {formatConfidence(value)}
      </Text>
    </View>
  );
};

const renderBanner = (message: string, variant: "success" | "error" | "warning") => (
  <View
    style={[
      styles.banner,
      variant === "success"
        ? styles.bannerSuccess
        : variant === "warning"
          ? styles.bannerWarning
          : styles.bannerError
    ]}
  >
    <Text
      style={[
        styles.bannerText,
        variant === "success"
          ? styles.bannerTextSuccess
          : variant === "warning"
            ? styles.bannerTextWarning
            : styles.bannerTextError
      ]}
    >
      {message}
    </Text>
  </View>
);

export function CaptureScreen({ navigation, route }: Props) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [entryMode, setEntryMode] = useState<"camera" | "manual" | "edit">("camera");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [isCreatingMeal, setIsCreatingMeal] = useState(false);
  const [isLoadingMeal, setIsLoadingMeal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPath, setUploadPath] = useState<string | null>(null);
  const [mealId, setMealId] = useState<string | null>(null);
  const [mealError, setMealError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappedItems, setMappedItems] = useState<MappedItem[] | null>(null);
  const [nutrientTotals, setNutrientTotals] = useState<NutrientTotals | null>(null);
  const [expandedIngredientProfiles, setExpandedIngredientProfiles] = useState<
    Record<string, boolean>
  >({});
  const [suggestionsByItemId, setSuggestionsByItemId] = useState<
    Record<string, FoodSuggestion[]>
  >({});
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const suggestionRequestIdRef = useRef<Record<string, number>>({});
  const suggestionTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [saveMealModalVisible, setSaveMealModalVisible] = useState(false);
  const [saveMealName, setSaveMealName] = useState("");
  const [isSavingMeal, setIsSavingMeal] = useState(false);

  const toParsedItems = useCallback(
    (items: EditableItem[]): ParsedItem[] =>
      items.map((item) => ({
        name: item.canonicalName ?? item.name,
        estimated_grams: toGrams(item.quantity, item.unit),
        confidence: Number.isFinite(item.confidence) ? item.confidence : 0.2,
        quantity: item.quantity,
        unit: item.unit,
        last_precise_unit: item.lastPreciseUnit,
        canonical_id: item.canonicalId ?? undefined,
        canonical_name: item.canonicalName ?? undefined
      })),
    []
  );

  const clearSuggestionTimersForItem = useCallback((itemId: string) => {
    const timerId = suggestionTimerRef.current[itemId];
    if (timerId) {
      clearTimeout(timerId);
      delete suggestionTimerRef.current[itemId];
    }
  }, []);

  const clearSuggestionsForItem = useCallback(
    (itemId: string) => {
      clearSuggestionTimersForItem(itemId);
      setSuggestionsByItemId((current) => {
        if (!(itemId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    },
    [clearSuggestionTimersForItem]
  );

  const requestFoodSuggestions = useCallback(async (itemId: string, rawQuery: string) => {
    const query = rawQuery.trim();
    if (query.length < 2) {
      setSuggestionError(null);
      setSuggestionsByItemId((current) => {
        if (!(itemId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      return;
    }

    const requestId = (suggestionRequestIdRef.current[itemId] ?? 0) + 1;
    suggestionRequestIdRef.current[itemId] = requestId;
    setSuggestionError(null);
    try {
      const { data, error } = await supabase.functions.invoke("search-foods", {
        body: {
          query,
          limit: 8
        }
      });
      if (error) {
        throw error;
      }
      const payload =
        typeof data === "string"
          ? (() => {
              try {
                return JSON.parse(data);
              } catch (jsonError) {
                return null;
              }
            })()
          : data;
      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string" &&
        payload.error.length > 0
      ) {
        throw new Error(payload.error);
      }
      const suggestions = parseFoodSuggestions(data);
      if (suggestionRequestIdRef.current[itemId] !== requestId) {
        return;
      }
      setSuggestionsByItemId((current) => ({
        ...current,
        [itemId]: suggestions
      }));
    } catch (error) {
      if (suggestionRequestIdRef.current[itemId] !== requestId) {
        return;
      }
      setSuggestionsByItemId((current) => ({
        ...current,
        [itemId]: []
      }));
      let message =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error !== null &&
              "message" in error &&
              typeof (error as { message: unknown }).message === "string"
            ? (error as { message: string }).message
            : "Unable to load food suggestions right now.";
      if (message.includes("non-2xx status code")) {
        message =
          "Food search is temporarily unavailable. You can still type a food name and continue.";
      }
      setSuggestionError(message);
    }
  }, []);

  const scheduleFoodSuggestions = useCallback(
    (itemId: string, query: string) => {
      clearSuggestionTimersForItem(itemId);
      if (query.trim().length < 2) {
        clearSuggestionsForItem(itemId);
        return;
      }
      suggestionTimerRef.current[itemId] = setTimeout(() => {
        requestFoodSuggestions(itemId, query);
      }, 150);
    },
    [clearSuggestionTimersForItem, clearSuggestionsForItem, requestFoodSuggestions]
  );

  useEffect(() => {
    return () => {
      Object.values(suggestionTimerRef.current).forEach((timerId) => clearTimeout(timerId));
    };
  }, []);

  const resetMealState = useCallback(() => {
    setUploadError(null);
    setUploadPath(null);
    setMealId(null);
    setMealError(null);
    setParsedItems(null);
    setParseError(null);
    setParseWarning(null);
    setEditableItems([]);
    setMappedItems(null);
    setMappingError(null);
    setNutrientTotals(null);
    setExpandedIngredientProfiles({});
    setSuggestionsByItemId({});
    setSuggestionError(null);
    suggestionRequestIdRef.current = {};
    Object.values(suggestionTimerRef.current).forEach((timerId) => clearTimeout(timerId));
    suggestionTimerRef.current = {};
  }, []);

  const applySelectedPhoto = useCallback(
    (uri: string, base64: string | null) => {
      navigation.setParams({ mealId: undefined });
      setEntryMode("camera");
      setPhotoUri(uri);
      setPhotoBase64(base64);
      setLibraryError(null);
      setManualError(null);
      resetMealState();
    },
    [navigation, resetMealState]
  );

  const startManualEntry = useCallback(() => {
    navigation.setParams({ mealId: undefined });
    setEntryMode("manual");
    setPhotoUri(null);
    setPhotoBase64(null);
    setLibraryError(null);
    resetMealState();
    setManualError(null);
    setEditableItems([
      {
        id: `${Date.now()}-manual-${Math.random().toString(36).slice(2, 6)}`,
        name: "",
        quantity: 0,
        quantityInput: "",
        unit: "g",
        lastPreciseUnit: "g",
        confidence: 0.2,
        canonicalId: null,
        canonicalName: null
      }
    ]);
  }, [navigation, resetMealState]);

  const exitManualEntry = useCallback(() => {
    navigation.setParams({ mealId: undefined });
    setEntryMode("camera");
    setManualError(null);
    resetMealState();
    setPhotoUri(null);
    setPhotoBase64(null);
  }, [navigation, resetMealState]);

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }
    setIsCapturing(true);
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        exif: false,
        base64: true
      });
      if (result?.uri) {
        applySelectedPhoto(result.uri, result.base64 ?? null);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSelectFromLibrary = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        setLibraryError("Library access is required to import a photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as ImagePicker.MediaType[],
        base64: true,
        quality: 0.5
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        if (asset?.uri) {
          applySelectedPhoto(asset.uri, asset.base64 ?? null);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to import a photo.";
      setLibraryError(message);
    }
  }, [applySelectedPhoto]);

  const createManualMeal = useCallback(async () => {
    setIsCreatingMeal(true);
    setManualError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        throw new Error("You must be signed in to log a meal.");
      }
      const { data: insertedMeal, error } = await supabase
        .from("meals")
        .insert({
          user_id: userId,
          photo_path: null
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      setMealId(insertedMeal.id);
      return insertedMeal.id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create manual meal.";
      setManualError(message);
      return null;
    } finally {
      setIsCreatingMeal(false);
    }
  }, []);

  const loadMealForEdit = useCallback(
    async (targetMealId: string) => {
      setIsLoadingMeal(true);
      setManualError(null);
      setMappingError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          throw new Error("You must be signed in to edit meals.");
        }
        const { data, error } = await supabase
          .from("meals")
          .select("id, final_items, parsed_items, nutrient_totals")
          .eq("id", targetMealId)
          .single();

        if (error) {
          throw error;
        }

        const finalItems = Array.isArray(data?.final_items) ? data.final_items : [];
        const parsedItems = Array.isArray(data?.parsed_items) ? data.parsed_items : [];
        const fallbackItems = finalItems.length ? finalItems : parsedItems;
        setEditableItems(
          fallbackItems.map((item) => {
            const grams =
              typeof item?.grams === "number"
                ? Math.max(item.grams, 0)
                : typeof item?.estimated_grams === "number"
                  ? Math.max(item.estimated_grams, 0)
                  : 0;
            const savedUnit = isQuantityUnit(item?.unit) ? item.unit : "g";
            const savedLastPrecise = isQuantityUnit(item?.last_precise_unit)
              ? item.last_precise_unit
              : savedUnit;
            const savedQuantity =
              typeof item?.quantity === "number" && Number.isFinite(item.quantity)
                ? Math.max(item.quantity, 0)
                : null;

            return {
              id: `${targetMealId}-${Math.random().toString(36).slice(2, 6)}`,
              name:
                typeof item?.canonical_name === "string" && item.canonical_name.trim()
                  ? item.canonical_name
                  : typeof item?.name === "string"
                    ? item.name
                    : "",
              quantity: (() => {
                const resolved = savedQuantity ?? grams;
                return Number.isFinite(resolved) ? Math.max(resolved, 0) : 0;
              })(),
              quantityInput: (() => {
                const resolved = savedQuantity ?? grams;
                return formatQuantityInput(
                  Number.isFinite(resolved) ? Math.max(resolved, 0) : 0
                );
              })(),
              unit: savedUnit,
              lastPreciseUnit: savedLastPrecise,
              confidence:
                typeof item?.confidence === "number" &&
                item.confidence >= 0 &&
                item.confidence <= 1
                  ? item.confidence
                  : 0.2,
              canonicalId:
                typeof item?.canonical_id === "string" && item.canonical_id.trim()
                  ? item.canonical_id
                  : null,
              canonicalName:
                typeof item?.canonical_name === "string" && item.canonical_name.trim()
                  ? item.canonical_name
                  : null
            };
          })
        );
        const mappedFromFinalItems = finalItems.length
          ? finalItems
              .filter(
                (item) =>
                  typeof item?.canonical_id === "string" &&
                  typeof item?.canonical_name === "string"
              )
              .map((item) => ({
                name:
                  typeof item?.name === "string" && item.name.trim()
                    ? item.name
                    : item.canonical_name,
                canonical_id: item.canonical_id,
                canonical_name: item.canonical_name,
                confidence:
                  typeof item?.confidence === "number" &&
                  item.confidence >= 0 &&
                  item.confidence <= 1
                    ? item.confidence
                    : 0.2,
                grams:
                  typeof item?.grams === "number" && Number.isFinite(item.grams)
                    ? Math.max(item.grams, 0)
                    : typeof item?.estimated_grams === "number" &&
                        Number.isFinite(item.estimated_grams)
                      ? Math.max(item.estimated_grams, 0)
                      : 0,
                nutrient_totals: parseItemNutrientTotals(item?.nutrient_totals)
              }))
          : null;
        const hydratedMappedItems = mappedFromFinalItems
          ? addNutrientsFromFoodProfiles(mappedFromFinalItems)
          : null;
        setMappedItems(hydratedMappedItems);
        setExpandedIngredientProfiles({});
        const mealTotals =
          data?.nutrient_totals && typeof data.nutrient_totals === "object"
            ? (data.nutrient_totals as NutrientTotals)
            : hydratedMappedItems
              ? computeMealTotalsAndInsights(hydratedMappedItems).nutrient_totals
              : null;
        setNutrientTotals(mealTotals);
        setMealId(targetMealId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load meal.";
        setManualError(message);
      } finally {
        setIsLoadingMeal(false);
      }
    },
    []
  );

  useEffect(() => {
    const targetMealId = route.params?.mealId;
    if (targetMealId) {
      setEntryMode("edit");
      setPhotoUri(null);
      setPhotoBase64(null);
      setLibraryError(null);
      resetMealState();
      loadMealForEdit(targetMealId);
    }
  }, [loadMealForEdit, resetMealState, route.params?.mealId]);

  const mapFoods = useCallback(async (items: ParsedItem[], newMealId: string) => {
    setIsMapping(true);
    setMappingError(null);
    setMappedItems(null);
    setNutrientTotals(null);
    setExpandedIngredientProfiles({});

    try {
      const { data, error } = await supabase.functions.invoke("map-foods", {
        body: {
          meal_id: newMealId,
          items
        }
      });

      if (error) {
        throw error;
      }

      const mappedWithSourceGrams = parseMappingPayload(data).map((mappedItem, index) => {
        const sourceItem = items[index];
        const sourceGrams =
          typeof sourceItem?.estimated_grams === "number" &&
          Number.isFinite(sourceItem.estimated_grams)
            ? Math.max(sourceItem.estimated_grams, 0)
            : mappedItem.grams;
        return {
          ...mappedItem,
          name: mappedItem.canonical_name,
          grams: sourceGrams
        };
      });
      const mapped = addNutrientsFromFoodProfiles(mappedWithSourceGrams);
      const persistedFinalItems = mapped.map((mappedItem, index) => {
        const sourceItem = items[index];
        const sourceGrams = mappedItem.grams;
        const sourceUnit = isQuantityUnit(sourceItem?.unit) ? sourceItem.unit : "g";
        const sourceQuantity =
          typeof sourceItem?.quantity === "number" && Number.isFinite(sourceItem.quantity)
            ? Math.max(sourceItem.quantity, 0)
            : sourceGrams;
        const sourceLastPreciseUnit = isQuantityUnit(sourceItem?.last_precise_unit)
          ? sourceItem.last_precise_unit
          : sourceUnit;

        return {
          ...mappedItem,
          name: mappedItem.canonical_name,
          grams: sourceGrams,
          quantity: sourceQuantity,
          unit: sourceUnit,
          last_precise_unit: sourceLastPreciseUnit
        };
      });

      const { nutrient_totals: mealTotals, insights } =
        computeMealTotalsAndInsights(mapped);

      const { error: persistError } = await supabase
        .from("meals")
        .update({
          final_items: persistedFinalItems,
          nutrient_totals: mealTotals,
          nutrient_db_version: NUTRIENT_DB_VERSION,
          insights
        })
        .eq("id", newMealId);

      if (persistError) {
        throw persistError;
      }

      setMappedItems(mapped);
      setExpandedIngredientProfiles({});
      setEditableItems((current) =>
        current.map((entry, index) => {
          const mappedItem = mapped[index];
          if (!mappedItem) {
            return entry;
          }
          return {
            ...entry,
            name: mappedItem.canonical_name,
            canonicalId: mappedItem.canonical_id,
            canonicalName: mappedItem.canonical_name,
            confidence: mappedItem.confidence
          };
        })
      );
      setSuggestionsByItemId({});
      setNutrientTotals(mealTotals);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Mapping failed. Check the map-foods function.";
      setMappingError(message);
    } finally {
      setIsMapping(false);
    }
  }, []);

  const openSaveMealModal = useCallback(() => {
    if (!mappedItems?.length) return;
    const names = mappedItems.slice(0, 2).map((i) => i.canonical_name).filter(Boolean);
    setSaveMealName(names.length ? names.join(", ") : "Saved meal");
    setSaveMealModalVisible(true);
  }, [mappedItems]);

  const confirmSaveMealFromCapture = useCallback(async () => {
    if (!saveMealName.trim() || !mappedItems?.length || !editableItems.length) {
      return;
    }
    setIsSavingMeal(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        throw new Error("You must be signed in to save meals.");
      }
      const savedItems = mappedItems.map((mappedItem, index) => {
        const editable = editableItems[index];
        return {
          canonical_id: mappedItem.canonical_id,
          canonical_name: mappedItem.canonical_name,
          name: mappedItem.canonical_name,
          grams: Math.max(0, mappedItem.grams),
          quantity: editable ? Math.max(0, editable.quantity) : Math.max(0, mappedItem.grams),
          unit: editable?.unit ?? "g",
          last_precise_unit: editable?.lastPreciseUnit ?? "g",
          confidence: mappedItem.confidence ?? 0.2
        };
      });
      const { error: insertError } = await supabase.from("saved_meals").insert({
        user_id: auth.user.id,
        name: saveMealName.trim(),
        items: savedItems
      });
      if (insertError) throw insertError;
      setSaveMealModalVisible(false);
      setSaveMealName("");
      navigation.navigate("Saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save meal.";
      setMappingError(message);
    } finally {
      setIsSavingMeal(false);
    }
  }, [mappedItems, editableItems, saveMealName, navigation]);

  const cancelSaveMealModal = useCallback(() => {
    setSaveMealModalVisible(false);
    setSaveMealName("");
  }, []);

  const parseMealPhoto = useCallback(async (photoPath: string, newMealId: string) => {
    setIsParsing(true);
    setParseError(null);
    setParseWarning(null);
    setParsedItems(null);

    try {
      const { data, error } = await supabase.functions.invoke("parse-meal", {
        body: {
          meal_id: newMealId,
          photo_path: photoPath
        }
      });

      if (error) {
        throw error;
      }

      let warning: string | null = null;
      let invokeError: string | null = null;
      if (data) {
        const payload =
          typeof data === "string"
            ? (() => {
                try {
                  return JSON.parse(data);
                } catch (error) {
                  return null;
                }
              })()
            : data;
        if (
          payload &&
          typeof payload === "object" &&
          "warning" in payload &&
          typeof payload.warning === "string"
        ) {
          warning = payload.warning;
        }
        if (
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof payload.error === "string"
        ) {
          invokeError = payload.error;
        }
      }
      if (warning) {
        setParseWarning(warning);
      }
      if (invokeError) {
        setParseError(invokeError);
      }
      const items = parseVisionPayload(data);
      setParsedItems(items);
      setEditableItems(
        items.map((item) => ({
          id: `${Date.now()}-${item.name}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.canonical_name ?? item.name,
          quantity: item.estimated_grams,
          quantityInput: formatQuantityInput(item.estimated_grams),
          unit: "g",
          lastPreciseUnit: "g",
          confidence: item.confidence,
          canonicalId: item.canonical_id ?? null,
          canonicalName: item.canonical_name ?? null
        }))
      );
      return items;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Parsing failed. Check the parse-meal function.";
      setParseError(message);
      return null;
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!photoUri || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setMealError(null);
    let stage: "upload" | "meal" | "parse" | "map" = "upload";

    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        throw new Error("You must be signed in to upload.");
      }

      const response = await fetch(
        photoBase64 ? `data:image/jpeg;base64,${photoBase64}` : photoUri
      );
      if (!response.ok) {
        throw new Error("Unable to read photo for upload.");
      }
      if (!photoBase64) {
        throw new Error("Camera capture missing base64. Please retake.");
      }
      const buffer = Uint8Array.from(atob(photoBase64), (char) => char.charCodeAt(0));
      if (!buffer.byteLength) {
        throw new Error("Captured photo was empty. Please retake.");
      }
      const fileExt = photoUri.split(".").pop() || "jpg";
      const filePath = `${userId}/${Date.now()}.${fileExt}`;
      const contentType = "image/jpeg";

      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(filePath, buffer, {
          contentType,
          upsert: false
        });

      if (error) {
        throw error;
      }

      setUploadPath(filePath);

      stage = "meal";
      const { data: insertedMeal, error: mealInsertError } = await supabase
        .from("meals")
        .insert({
          user_id: userId,
          photo_path: filePath
        })
        .select("id")
        .single();

      if (mealInsertError) {
        throw mealInsertError;
      }

      setMealId(insertedMeal.id);
      stage = "parse";
      const items = await parseMealPhoto(filePath, insertedMeal.id);
      if (items) {
        stage = "map";
        await mapFoods(items, insertedMeal.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      if (stage === "map") {
        setMappingError(message);
      } else if (stage === "parse") {
        setParseError(message);
      } else if (stage === "meal") {
        setMealError(message);
      } else {
        setUploadError(message);
      }
    } finally {
      setIsUploading(false);
    }
  }, [photoUri, isUploading, mapFoods, parseMealPhoto]);

  const handleRecalculate = useCallback(async (options?: { allowCreate?: boolean }) => {
    if (!editableItems.length) {
      setMappingError("Add at least one food to recalculate.");
      return;
    }
    const hasUnnamedItem = editableItems.some((item) => !item.name.trim());
    if (hasUnnamedItem) {
      setMappingError("Each food row needs a name.");
      return;
    }
    const hasUnlockedItem = editableItems.some((item) => !item.canonicalId);
    if (hasUnlockedItem) {
      setMappingError("Select a canonical food from suggestions for each row before recalculating.");
      return;
    }
    let activeMealId = mealId;
    if (!activeMealId && options?.allowCreate) {
      activeMealId = await createManualMeal();
    }
    if (!activeMealId) {
      setMappingError("Meal not created yet.");
      return;
    }
    setMappingError(null);
    await mapFoods(toParsedItems(editableItems), activeMealId);
  }, [createManualMeal, editableItems, mealId, mapFoods, toParsedItems]);

  const renderEditableFoods = (options?: { allowCreate?: boolean }) => (
    <View style={styles.editableList}>
      <Text style={styles.sectionTitle}>Editable foods</Text>
      {editableItems.map((item) => (
        <View key={item.id} style={styles.editableRow}>
          <TextInput
            style={styles.input}
            value={item.name}
            onChangeText={(value) => {
              setEditableItems((current) =>
                current.map((entry) =>
                  entry.id === item.id
                    ? {
                        ...entry,
                        name: value,
                        canonicalId: null,
                        canonicalName: null
                      }
                    : entry
                )
              );
              scheduleFoodSuggestions(item.id, value);
            }}
            onFocus={() => {
              if (!item.canonicalId) {
                scheduleFoodSuggestions(item.id, item.name);
              }
            }}
            placeholder="Search canonical food"
          />
          {item.canonicalId ? (
            <Text style={styles.lockedCanonicalText}>
              Locked: {item.canonicalName ?? item.name}
            </Text>
          ) : null}
          {suggestionsByItemId[item.id]?.length ? (
            <View style={styles.suggestionList}>
              {suggestionsByItemId[item.id].map((suggestion) => (
                <Pressable
                  key={`${item.id}-${suggestion.canonical_id}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setEditableItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id
                          ? {
                              ...entry,
                              name: suggestion.canonical_name,
                              canonicalId: suggestion.canonical_id,
                              canonicalName: suggestion.canonical_name
                            }
                          : entry
                      )
                    );
                    clearSuggestionsForItem(item.id);
                  }}
                  style={styles.suggestionRow}
                >
                  <Text style={styles.suggestionText}>{suggestion.canonical_name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            value={item.quantityInput}
            onChangeText={(value) => {
              const normalized = value.replace(",", ".");
              if (!/^\d*\.?\d*$/.test(normalized)) {
                return;
              }
              const parsed = Number.parseFloat(normalized);
              setEditableItems((current) =>
                current.map((entry) =>
                  entry.id === item.id
                    ? {
                        ...entry,
                        quantityInput: normalized,
                        quantity: Number.isNaN(parsed) ? 0 : Math.max(parsed, 0)
                      }
                    : entry
                )
              );
            }}
            onBlur={() => {
              setEditableItems((current) =>
                current.map((entry) =>
                  entry.id === item.id
                    ? { ...entry, quantityInput: formatQuantityInput(entry.quantity) }
                    : entry
                )
              );
            }}
            keyboardType="decimal-pad"
            placeholder="Amount"
          />
          <View style={styles.unitPickerWrap}>
            {QUANTITY_UNITS.map((unit) => (
              <Pressable
                key={`${item.id}-${unit}`}
                accessibilityRole="button"
                onPress={() => {
                  setEditableItems((current) =>
                    current.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, unit, lastPreciseUnit: unit }
                        : entry
                    )
                  );
                }}
                style={[
                  styles.unitChip,
                  item.unit === unit ? styles.unitChipSelected : null
                ]}
              >
                <Text
                  style={[
                    styles.unitChipText,
                    item.unit === unit ? styles.unitChipTextSelected : null
                  ]}
                >
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.convertedHint}>
            Normalized: {Math.round(toGrams(item.quantity, item.unit))}g
          </Text>
          <AppButton
            title="Remove"
            onPress={() => {
              setEditableItems((current) =>
                current.filter((entry) => entry.id !== item.id)
              );
              clearSuggestionsForItem(item.id);
            }}
            variant="secondary"
            fullWidth={false}
          />
        </View>
      ))}
      <AppButton
        title="Add food"
        onPress={() => {
          setEditableItems((current) => [
            ...current,
            {
              id: `${Date.now()}-new-${Math.random().toString(36).slice(2, 6)}`,
              name: "",
              quantity: 0,
              quantityInput: "",
              unit: "g",
              lastPreciseUnit: "g",
              confidence: 0.2,
              canonicalId: null,
              canonicalName: null
            }
          ]);
        }}
        variant="secondary"
      />
      <AppButton
        title={
          isCreatingMeal
            ? "Starting meal..."
            : isMapping
              ? "Recalculating..."
              : "Recalculate nutrients"
        }
        onPress={() => handleRecalculate(options)}
        disabled={isMapping || isCreatingMeal}
      />
    </View>
  );

  const renderMappedFoodsSection = () => {
    if (!mappedItems) {
      return null;
    }
    return (
      <View style={styles.parsedList}>
        <Text style={styles.sectionTitle}>Canonical selected foods</Text>
        {mappedItems.length ? (
          mappedItems.map((item, index) => {
            const itemKey = `${item.canonical_id}-${index}`;
            const isExpanded = Boolean(expandedIngredientProfiles[itemKey]);
            const nutrientKeysForItem = item.nutrient_totals
              ? NUTRIENT_KEYS.filter((key) => item.nutrient_totals!.percent_dv[key] > 0)
              : [];
            return (
              <View key={itemKey} style={styles.ingredientProfileCard}>
                <View style={styles.parsedRow}>
                  <Text style={styles.parsedItemText}>
                    {item.canonical_name}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    isExpanded
                      ? `Hide nutrition profile for ${item.canonical_name}`
                      : `Show nutrition profile for ${item.canonical_name}`
                  }
                  onPress={() =>
                    setExpandedIngredientProfiles((current) => ({
                      ...current,
                      [itemKey]: !current[itemKey]
                    }))
                  }
                  style={({ pressed }) => [
                    styles.profileToggleButton,
                    pressed ? styles.profileToggleButtonPressed : null
                  ]}
                >
                  <Text style={styles.profileToggleButtonText}>
                    {isExpanded ? "Hide profile" : "Show profile"}
                  </Text>
                </Pressable>
                {isExpanded ? (
                  item.nutrient_totals ? (
                    nutrientKeysForItem.length ? (
                      <View style={styles.ingredientNutrientList}>
                        {nutrientKeysForItem.map((key) => (
                          <NutrientBarRow
                            key={`${itemKey}-${key}`}
                            label={formatNutrientLabel(key)}
                            percentDv={item.nutrient_totals!.percent_dv[key]}
                            onPress={() =>
                              (navigation.getParent() as { navigate: (a: string, b: { nutrientKey: string }) => void }).navigate(
                                "NutrientDetail",
                                { nutrientKey: key }
                              )
                            }
                          />
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.ingredientProfileHint}>
                        No tracked micronutrients for this ingredient at the current amount.
                      </Text>
                    )
                  ) : (
                    <Text style={styles.ingredientProfileHint}>
                      Profile unavailable. Recalculate nutrients to refresh this ingredient.
                    </Text>
                  )
                ) : null}
              </View>
            );
          })
        ) : (
          <EmptyState message="No foods mapped yet. Edit foods above and recalculate." />
        )}
      </View>
    );
  };

  if (entryMode === "manual" || entryMode === "edit") {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
          <View style={styles.manualHeader}>
            <Text style={styles.title}>
              {entryMode === "edit" ? "Edit meal" : "Manual meal"}
            </Text>
            <Text style={styles.subtitle}>
              {entryMode === "edit"
                ? "Update foods, quantity, and units, then recalculate nutrients."
                : "Enter foods with quantity and units, then calculate nutrients."}
            </Text>
          </View>
          <View style={styles.actions}>
            {entryMode === "edit" ? (
              <AppButton
                title="Back to history"
                onPress={() => {
                  navigation.setParams({ mealId: undefined });
                  setEntryMode("camera");
                  setPhotoUri(null);
                  setPhotoBase64(null);
                  resetMealState();
                  navigation.navigate("History");
                }}
                variant="secondary"
              />
            ) : (
              <AppButton
                title="Use camera instead"
                onPress={exitManualEntry}
                variant="secondary"
              />
            )}
          </View>
          {manualError ? renderBanner(manualError, "error") : null}
          {suggestionError ? renderBanner(suggestionError, "error") : null}
          {isLoadingMeal ? <ActivityIndicator style={styles.spinner} /> : null}
          {renderEditableFoods({ allowCreate: entryMode === "manual" })}
          {isMapping ? <ActivityIndicator style={styles.spinner} /> : null}
          {renderMappedFoodsSection()}
          {mappedItems && mappedItems.length > 0 ? (
            <View style={styles.saveMealRow}>
              <AppButton
                title="Save meal"
                onPress={openSaveMealModal}
                variant="secondary"
                fullWidth={false}
              />
            </View>
          ) : null}
          {nutrientTotals ? (
            <View style={styles.parsedList}>
              <Text style={styles.sectionTitle}>
                Micronutrients (%DV)
              </Text>
              {NUTRIENT_KEYS.length ? (
                NUTRIENT_KEYS.map((key) => (
                  <NutrientBarRow
                    key={key}
                    label={formatNutrientLabel(key)}
                    percentDv={nutrientTotals.percent_dv[key]}
                    onPress={() =>
                      (navigation.getParent() as { navigate: (a: string, b: { nutrientKey: string }) => void }).navigate(
                        "NutrientDetail",
                        { nutrientKey: key }
                      )
                    }
                  />
                ))
              ) : (
                <EmptyState message="No nutrient totals yet." />
              )}
            </View>
          ) : null}
          {mappingError ? renderBanner(mappingError, "error") : null}
          <Text style={styles.hint}>
            Update foods above and tap “Recalculate nutrients” to refresh totals.
          </Text>
          <Text style={styles.disclaimer}>
            Source uses quantity and unit conversion (volume assumes 1 ml approx 1 g). Nutrient data is informational and not medical advice.
          </Text>
        </ScrollView>
        <Modal
          visible={saveMealModalVisible}
          transparent
          animationType="fade"
          onRequestClose={cancelSaveMealModal}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={cancelSaveMealModal} />
            <View style={styles.saveMealModalCard}>
              <Text style={styles.saveMealModalTitle}>Save meal</Text>
              <Text style={styles.saveMealModalSubtitle}>Name this saved meal to reuse later.</Text>
              <TextInput
                style={styles.saveMealInput}
                placeholder="e.g. Breakfast usual"
                placeholderTextColor="#888"
                value={saveMealName}
                onChangeText={setSaveMealName}
                editable={!isSavingMeal}
                autoCapitalize="words"
              />
              <View style={styles.saveMealModalActions}>
                <AppButton
                  title="Cancel"
                  onPress={cancelSaveMealModal}
                  variant="secondary"
                  fullWidth={false}
                />
                <AppButton
                  title={isSavingMeal ? "Saving…" : "Save"}
                  onPress={confirmSaveMealFromCapture}
                  variant="primary"
                  fullWidth={false}
                  disabled={!saveMealName.trim() || isSavingMeal}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.subtitle}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.subtitle}>
          Enable camera permission to capture meal photos.
        </Text>
        <AppButton title="Allow camera access" onPress={requestPermission} />
        <AppButton
          title="Import from library"
          onPress={handleSelectFromLibrary}
          variant="secondary"
        />
        <AppButton
          title="Enter manually"
          onPress={startManualEntry}
          variant="secondary"
        />
        {libraryError ? renderBanner(libraryError, "error") : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {photoUri ? (
        <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
          <View style={styles.photoPreviewWrap}>
            <Image
              source={{ uri: photoUri }}
              style={styles.image}
              resizeMode="cover"
            />
            {isUploading ? (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.uploadStatusText}>
                  {isMapping
                    ? "Matching foods…"
                    : isParsing
                      ? "Analyzing photo…"
                      : "Uploading…"}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.actions}>
            <AppButton
              title="Retake"
              variant="secondary"
              onPress={() => {
                setPhotoUri(null);
                setPhotoBase64(null);
                resetMealState();
              }}
              disabled={isUploading}
            />
            <AppButton
              title="Use photo"
              onPress={handleUpload}
              disabled={isUploading}
            />
          </View>
          {uploadError ? renderBanner(uploadError, "error") : null}
          {mealError ? renderBanner(mealError, "error") : null}
          {!isUploading && uploadPath && mealId && !uploadError && !mealError ? (
            <View style={[styles.banner, styles.bannerSuccess]}>
              <Text style={[styles.bannerText, styles.bannerTextSuccess]}>
                Photo saved. Review or edit items below.
              </Text>
            </View>
          ) : null}
          {parsedItems ? (
            <View style={styles.parsedList}>
              <Text style={styles.sectionTitle}>Parsed foods (AI)</Text>
              {parsedItems.length ? (
                parsedItems.map((item, index) => (
                  <View key={`${item.name}-${index}`} style={styles.parsedRow}>
                    <Text style={styles.parsedItemText}>
                      {(item.canonical_name ?? item.name)} · {Math.round(item.estimated_grams)}g
                    </Text>
                    {renderConfidenceBadge(item.confidence)}
                  </View>
                ))
              ) : (
                <EmptyState message="No foods detected. Add items below to continue." />
              )}
            </View>
          ) : null}
          {parseError ? renderBanner(parseError, "error") : null}
          {parseWarning ? renderBanner(parseWarning, "warning") : null}
          {suggestionError ? renderBanner(suggestionError, "error") : null}
          {editableItems.length ? renderEditableFoods() : null}
          {renderMappedFoodsSection()}
          {nutrientTotals ? (
            <View style={styles.parsedList}>
              <Text style={styles.sectionTitle}>
                Micronutrients (%DV)
              </Text>
              {NUTRIENT_KEYS.length ? (
                NUTRIENT_KEYS.map((key) => (
                  <NutrientBarRow
                    key={key}
                    label={formatNutrientLabel(key)}
                    percentDv={nutrientTotals.percent_dv[key]}
                    onPress={() =>
                      (navigation.getParent() as { navigate: (a: string, b: { nutrientKey: string }) => void }).navigate(
                        "NutrientDetail",
                        { nutrientKey: key }
                      )
                    }
                  />
                ))
              ) : (
                <EmptyState message="No nutrient totals yet." />
              )}
            </View>
          ) : null}
          {mappingError ? renderBanner(mappingError, "error") : null}
          {(uploadPath || parsedItems !== null || editableItems.length > 0) ? (
            <>
              <Text style={styles.hint}>
                Update foods above and tap “Recalculate nutrients” to refresh totals.
              </Text>
              <Text style={styles.disclaimer}>
                Source uses quantity and unit conversion (volume assumes 1 ml approx 1 g). Nutrient data is informational and not medical advice.
              </Text>
            </>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.actions}>
            <AppButton
              title={isCapturing ? "Capturing..." : "Capture"}
              onPress={handleCapture}
              disabled={isCapturing}
            />
            <AppButton
              title="Import photo"
              onPress={handleSelectFromLibrary}
              variant="secondary"
            />
            <AppButton
              title="Enter manually"
              onPress={startManualEntry}
              variant="secondary"
            />
          </View>
          {libraryError ? renderBanner(libraryError, "error") : null}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: "#666"
  },
  cameraContainer: {
    flex: 1
  },
  camera: {
    flex: 1
  },
  actions: {
    padding: 16,
    gap: 12,
    backgroundColor: "#fff"
  },
  preview: {
    flex: 1,
    backgroundColor: "#fff"
  },
  previewContent: {
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12
  },
  manualHeader: {
    marginHorizontal: 16,
    gap: 4
  },
  photoPreviewWrap: {
    width: "100%",
    height: 260,
    backgroundColor: "#f0f0f0",
    overflow: "hidden",
    position: "relative"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  uploadStatusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff"
  },
  spinner: {
    marginTop: 8
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12
  },
  bannerText: {
    fontSize: 13,
    fontWeight: "600"
  },
  bannerSuccess: {
    backgroundColor: "#e6f4ea"
  },
  bannerError: {
    backgroundColor: "#fce8e6"
  },
  bannerWarning: {
    backgroundColor: "#fff4cc"
  },
  bannerTextSuccess: {
    color: "#1a7f37"
  },
  bannerTextWarning: {
    color: "#7a5e00"
  },
  bannerTextError: {
    color: "#b42318"
  },
  parsedList: {
    marginHorizontal: 16,
    padding: 12,
    gap: 6,
    backgroundColor: "#f6f6f6",
    borderRadius: 12
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111"
  },
  parsedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8
  },
  ingredientProfileCard: {
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eaecf0"
  },
  profileToggleButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eaecf0"
  },
  profileToggleButtonPressed: {
    opacity: 0.8
  },
  profileToggleButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#344054"
  },
  ingredientNutrientList: {
    gap: 8
  },
  ingredientProfileHint: {
    fontSize: 12,
    color: "#667085"
  },
  bandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  parsedItemText: {
    fontSize: 13,
    color: "#333",
    flexShrink: 1
  },
  nutrientBandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  nutrientBandBadgeText: {
    fontSize: 12,
    fontWeight: "600"
  },
  confidenceLabel: {
    fontSize: 12,
    color: "#666"
  },
  confidenceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  confidenceBadgeText: {
    fontSize: 12,
    fontWeight: "600"
  },
  editableList: {
    marginHorizontal: 16,
    padding: 12,
    gap: 10,
    backgroundColor: "#f6f6f6",
    borderRadius: 12
  },
  editableRow: {
    gap: 8,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee"
  },
  unitPickerWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  unitChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f2f4f7"
  },
  unitChipSelected: {
    backgroundColor: "#111"
  },
  unitChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#344054"
  },
  unitChipTextSelected: {
    color: "#fff"
  },
  convertedHint: {
    fontSize: 12,
    color: "#667085"
  },
  lockedCanonicalText: {
    fontSize: 12,
    color: "#475467",
    fontWeight: "600"
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 8,
    overflow: "hidden"
  },
  suggestionRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#eaecf0"
  },
  suggestionText: {
    fontSize: 13,
    color: "#1d2939"
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14
  },
  hint: {
    padding: 16,
    fontSize: 14,
    color: "#666",
    backgroundColor: "#fff"
  },
  disclaimer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    fontSize: 12,
    color: "#777",
    backgroundColor: "#fff"
  },
  saveMealRow: {
    marginHorizontal: 16,
    marginTop: 4
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  saveMealModalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 20,
    gap: 8
  },
  saveMealModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111"
  },
  saveMealModalSubtitle: {
    fontSize: 14,
    color: "#555"
  },
  saveMealInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
    marginBottom: 8
  },
  saveMealModalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end"
  }
});
