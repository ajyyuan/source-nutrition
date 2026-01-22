import { useRef, useState } from "react";
import { Button, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";

export function CaptureScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

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
      }
    } finally {
      setIsCapturing(false);
    }
  };

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
            <Button title="Retake" onPress={() => setPhotoUri(null)} />
            <Button title="Use photo" onPress={() => {}} />
          </View>
          <Text style={styles.hint}>Next: upload and create meal record.</Text>
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
  hint: {
    padding: 16,
    fontSize: 14,
    color: "#666",
    backgroundColor: "#fff"
  }
});
