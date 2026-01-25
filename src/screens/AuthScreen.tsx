import { useState } from "react";
import { ActivityIndicator, Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const redirectUrl = "source://auth";

  const handleSignIn = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert("Email required", "Enter the email you want to sign in with.");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    setIsLoading(false);

    if (error) {
      Alert.alert("Sign-in failed", error.message);
      return;
    }

    Alert.alert("Check your email", "Open the magic link to finish signing in.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Use a magic link to continue.</Text>
      <View style={styles.form}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          style={styles.input}
          value={email}
        />
        <Button title={isLoading ? "Sending link..." : "Send magic link"} onPress={handleSignIn} />
        {isLoading ? <ActivityIndicator style={styles.spinner} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center"
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24
  },
  form: {
    gap: 12
  },
  input: {
    borderColor: "#ddd",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  spinner: {
    marginTop: 12
  }
});
