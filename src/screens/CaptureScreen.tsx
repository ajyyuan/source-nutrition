import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";

import { supabase } from "../lib/supabase";

const PHOTO_BUCKET = "meal-photos";

type ParsedItem = {
  name: string;
  estimated_grams: number;
  confidence: number;
};

type EditableItem = {
  id: string;
  name: string;
  grams: number;
  confidence: number;
};

type MappedItem = {
  name: string;
  canonical_id: string;
  canonical_name: string;
  confidence: number;
};

type NutrientVector = {
  vitamin_a_ug: number;
  vitamin_c_mg: number;
  vitamin_d_ug: number;
  vitamin_e_mg: number;
  vitamin_k_ug: number;
  thiamin_mg: number;
  riboflavin_mg: number;
  niacin_mg: number;
  vitamin_b6_mg: number;
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

const parseVisionPayload = (payload: unknown): ParsedItem[] => {
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
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
    if (typeof candidate.name !== "string" || !candidate.name.trim()) {
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
      name: candidate.name.trim(),
      estimated_grams: candidate.estimated_grams,
      confidence: candidate.confidence
    };
  });
};

const parseMappingPayload = (payload: unknown): MappedItem[] => {
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
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
      confidence: candidate.confidence
    };
  });
};

const parseNutrientTotals = (payload: unknown): NutrientTotals | null => {
  const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!parsed || typeof parsed !== "object" || !("nutrient_totals" in parsed)) {
    return null;
  }
  const totals = (parsed as { nutrient_totals?: NutrientTotals }).nutrient_totals;
  if (!totals || typeof totals !== "object") {
    return null;
  }
  return totals;
};

const formatConfidence = (value: number) => `Confidence: ${Math.round(value * 100)}%`;

export function CaptureScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPath, setUploadPath] = useState<string | null>(null);
  const [mealId, setMealId] = useState<string | null>(null);
  const [mealError, setMealError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [isMapping, setIsMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mappedItems, setMappedItems] = useState<MappedItem[] | null>(null);
  const [nutrientTotals, setNutrientTotals] = useState<NutrientTotals | null>(null);

  const toParsedItems = useCallback(
    (items: EditableItem[]): ParsedItem[] =>
      items.map((item) => ({
        name: item.name,
        estimated_grams: Number.isFinite(item.grams) ? item.grams : 0,
        confidence: Number.isFinite(item.confidence) ? item.confidence : 0.2
      })),
    []
  );

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }
    setIsCapturing(true);
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        exif: false
      });
      if (result?.uri) {
        setPhotoUri(result.uri);
        setUploadError(null);
        setUploadPath(null);
        setMealId(null);
        setMealError(null);
        setParsedItems(null);
        setParseError(null);
        setEditableItems([]);
        setMappedItems(null);
        setMappingError(null);
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const mapFoods = useCallback(async (items: ParsedItem[], newMealId: string) => {
    setIsMapping(true);
    setMappingError(null);
    setMappedItems(null);
    setNutrientTotals(null);

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

      const mapped = parseMappingPayload(data);
      setMappedItems(mapped);
      setNutrientTotals(parseNutrientTotals(data));
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

  const parseMealPhoto = useCallback(async (photoPath: string, newMealId: string) => {
    setIsParsing(true);
    setParseError(null);
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

      const items = parseVisionPayload(data);
      setParsedItems(items);
      setEditableItems(
        items.map((item) => ({
          id: `${Date.now()}-${item.name}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          grams: item.estimated_grams,
          confidence: item.confidence
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

      const response = await fetch(photoUri);
      const blob = await response.blob();
      const fileExt = photoUri.split(".").pop() || "jpg";
      const filePath = `${userId}/${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(filePath, blob, {
          contentType: blob.type || "image/jpeg",
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

  const handleRecalculate = useCallback(async () => {
    if (!mealId) {
      setMappingError("Meal not created yet.");
      return;
    }
    if (!editableItems.length) {
      setMappingError("Add at least one food to recalculate.");
      return;
    }
    setMappingError(null);
    await mapFoods(toParsedItems(editableItems), mealId);
  }, [editableItems, mealId, mapFoods, toParsedItems]);

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
        <Button title="Allow camera access" onPress={requestPermission} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {photoUri ? (
        <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
          <Image source={{ uri: photoUri }} style={styles.image} />
          <View style={styles.actions}>
            <Button
              title="Retake"
              onPress={() => {
                setPhotoUri(null);
                setUploadPath(null);
                setUploadError(null);
                setMealId(null);
                setMealError(null);
                setParsedItems(null);
                setParseError(null);
                setEditableItems([]);
                setMappedItems(null);
                setMappingError(null);
        setNutrientTotals(null);
              }}
            />
            <Button title={isUploading ? "Uploading..." : "Use photo"} onPress={handleUpload} />
          </View>
          {isUploading ? <ActivityIndicator style={styles.spinner} /> : null}
          {uploadPath ? (
            <Text style={styles.success}>Uploaded to: {uploadPath}</Text>
          ) : null}
          {uploadError ? <Text style={styles.error}>{uploadError}</Text> : null}
          {mealId ? (
            <Text style={styles.success}>Meal created: {mealId}</Text>
          ) : null}
          {mealError ? <Text style={styles.error}>{mealError}</Text> : null}
          {isParsing ? <ActivityIndicator style={styles.spinner} /> : null}
          {parsedItems ? (
            <View style={styles.parsedList}>
              <Text style={styles.sectionTitle}>Parsed foods (AI)</Text>
              {parsedItems.map((item, index) => (
                <Text key={`${item.name}-${index}`} style={styles.parsedItem}>
                  {item.name} · {Math.round(item.estimated_grams)}g ·{" "}
                  {formatConfidence(item.confidence)}
                </Text>
              ))}
            </View>
          ) : null}
          {parseError ? <Text style={styles.error}>{parseError}</Text> : null}
          {editableItems.length ? (
            <View style={styles.editableList}>
              <Text style={styles.sectionTitle}>Editable foods</Text>
              {editableItems.map((item, index) => (
                <View key={item.id} style={styles.editableRow}>
                  <TextInput
                    style={styles.input}
                    value={item.name}
                    onChangeText={(value) => {
                      setEditableItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id ? { ...entry, name: value } : entry
                        )
                      );
                    }}
                    placeholder="Food name"
                  />
                  <TextInput
                    style={styles.input}
                    value={Number.isFinite(item.grams) ? String(item.grams) : ""}
                    onChangeText={(value) => {
                      const parsed = Number.parseFloat(value);
                      setEditableItems((current) =>
                        current.map((entry) =>
                          entry.id === item.id
                            ? {
                                ...entry,
                                grams: Number.isNaN(parsed) ? 0 : Math.max(parsed, 0)
                              }
                            : entry
                        )
                      );
                    }}
                    keyboardType="numeric"
                    placeholder="Grams"
                  />
                  <Button
                    title="Remove"
                    onPress={() => {
                      setEditableItems((current) =>
                        current.filter((entry) => entry.id !== item.id)
                      );
                    }}
                  />
                  <Text style={styles.confidenceLabel}>{formatConfidence(item.confidence)}</Text>
                </View>
              ))}
              <Button
                title="Add food"
                onPress={() => {
                  setEditableItems((current) => [
                    ...current,
                    {
                      id: `${Date.now()}-new-${Math.random().toString(36).slice(2, 6)}`,
                      name: "",
                      grams: 0,
                      confidence: 0.2
                    }
                  ]);
                }}
              />
              <Button
                title={isMapping ? "Recalculating..." : "Recalculate nutrients"}
                onPress={handleRecalculate}
                disabled={isMapping || !mealId}
              />
            </View>
          ) : null}
          {isMapping ? <ActivityIndicator style={styles.spinner} /> : null}
          {mappedItems ? (
            <View style={styles.parsedList}>
              <Text style={styles.sectionTitle}>Canonical mapping</Text>
              {mappedItems.map((item, index) => (
                <Text key={`${item.canonical_id}-${index}`} style={styles.parsedItem}>
                  {item.name} → {item.canonical_name} · {formatConfidence(item.confidence)}
                </Text>
              ))}
            </View>
          ) : null}
          {nutrientTotals ? (
            <View style={styles.parsedList}>
              <Text style={styles.sectionTitle}>Micronutrients (%DV)</Text>
              {Object.entries(nutrientTotals.percent_dv).map(([key, value]) => (
                <Text key={key} style={styles.parsedItem}>
                  {key.replace(/_/g, " ")} · {Math.round(value * 100)}%
                </Text>
              ))}
            </View>
          ) : null}
          {mappingError ? <Text style={styles.error}>{mappingError}</Text> : null}
          <Text style={styles.hint}>
            Update foods above and tap “Recalculate nutrients” to refresh totals.
          </Text>
        </ScrollView>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.actions}>
            <Button title={isCapturing ? "Capturing..." : "Capture"} onPress={handleCapture} />
          </View>
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
    paddingBottom: 16
  },
  image: {
    width: "100%",
    height: 260
  },
  spinner: {
    marginTop: 8
  },
  success: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 13,
    color: "#1a7f37"
  },
  error: {
    paddingHorizontal: 16,
    paddingTop: 8,
    fontSize: 13,
    color: "#b42318"
  },
  parsedList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 6
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111"
  },
  parsedItem: {
    fontSize: 13,
    color: "#333"
  },
  confidenceLabel: {
    fontSize: 12,
    color: "#666"
  },
  editableList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8
  },
  editableRow: {
    gap: 8
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
  }
});
