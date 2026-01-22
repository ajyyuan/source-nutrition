import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Button, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";

import { supabase } from "../lib/supabase";

const PHOTO_BUCKET = "meal-photos";

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
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!photoUri || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setMealError(null);
    let stage: "upload" | "meal" = "upload";

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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      if (stage === "meal") {
        setMealError(message);
      } else {
        setUploadError(message);
      }
    } finally {
      setIsUploading(false);
    }
  }, [photoUri, isUploading]);

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
        <View style={styles.preview}>
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
          <Text style={styles.hint}>Next: store foods after upload.</Text>
        </View>
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
  image: {
    flex: 1
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
  hint: {
    padding: 16,
    fontSize: 14,
    color: "#666",
    backgroundColor: "#fff"
  }
});
