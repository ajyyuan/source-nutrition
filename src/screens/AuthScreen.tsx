import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

import { AppButton } from "../lib/AppButton";
import { supabase } from "../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const parseParams = (value: string) =>
  value
    .split("&")
    .map((pair) => pair.split("="))
    .reduce<Record<string, string>>((acc, [key, val]) => {
      if (!key) {
        return acc;
      }
      acc[decodeURIComponent(key)] = decodeURIComponent(val ?? "");
      return acc;
    }, {});

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"apple" | "google" | null>(null);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const redirectUrl = AuthSession.makeRedirectUri({ scheme: "source", path: "auth" });

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

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setIsAppleAvailable)
      .catch(() => setIsAppleAvailable(false));
  }, []);

  const handleAppleSignIn = async () => {
    setOauthProvider("apple");
    setOauthMessage(null);
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ],
        nonce: hashedNonce
      });

      if (!credential.identityToken) {
        Alert.alert("Sign-in failed", "Missing Apple identity token.");
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce
      });
      if (error) {
        Alert.alert("Sign-in failed", error.message);
      }
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: string }).code || "")
          : "";
      if (code === "ERR_REQUEST_CANCELED") {
        return;
      }
      const message = error instanceof Error ? error.message : "Apple sign-in failed.";
      const details = code ? `${message}\n(code: ${code})` : message;
      Alert.alert("Sign-in failed", details);
    } finally {
      setOauthProvider(null);
    }
  };

  const handleOAuthSignIn = async (provider: "google") => {
    setOauthProvider(provider);
    setOauthMessage("Opening web sign-in…");
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true
        }
      });

      if (error) {
        Alert.alert("Sign-in failed", error.message);
        return;
      }

      if (!data?.url) {
        Alert.alert("Sign-in failed", "Missing authentication URL.");
        setOauthMessage("Missing authentication URL.");
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type !== "success" || !result.url) {
        const statusMessage = `Web sign-in ended (${result.type}).`;
        setOauthMessage(statusMessage);
        if (result.type === "dismiss") {
          Alert.alert("Web sign-in closed", "The sign-in window closed before completion.");
        }
        return;
      }

      const [base, hash = ""] = result.url.split("#");
      const queryString = base.includes("?") ? base.split("?")[1] : "";
      const queryParams = queryString ? parseParams(queryString) : {};
      const hashParams = hash ? parseParams(hash) : {};
      const authCode = queryParams.code;
      const accessToken = hashParams.access_token;
      const refreshToken = hashParams.refresh_token;
      const errorMessage =
        queryParams.error_description ||
        queryParams.error ||
        hashParams.error_description ||
        hashParams.error;

      if (errorMessage) {
        Alert.alert("Sign-in failed", String(errorMessage));
        return;
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          Alert.alert("Sign-in failed", error.message);
          setOauthMessage("Web sign-in failed during token exchange.");
        }
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        if (error) {
          Alert.alert("Sign-in failed", error.message);
          setOauthMessage("Web sign-in failed while setting session.");
        }
        return;
      }

      Alert.alert(
        "Sign-in incomplete",
        `No auth code or tokens returned.\n${result.url ?? ""}`
      );
      setOauthMessage("Web sign-in returned no code or tokens.");
    } finally {
      setOauthProvider(null);
    }
  };

  const isOauthLoading = oauthProvider !== null;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Use a magic link to continue.</Text>
      <View style={styles.form}>
        <AppButton
          title="Continue with Apple"
          onPress={handleAppleSignIn}
          variant="secondary"
          disabled={isOauthLoading || isLoading || !isAppleAvailable}
        />
        <AppButton
          title="Continue with Google"
          onPress={() => handleOAuthSignIn("google")}
          variant="secondary"
          disabled={isOauthLoading || isLoading}
        />
        {oauthMessage ? <Text style={styles.oauthMessage}>{oauthMessage}</Text> : null}
        <Text style={styles.orLabel}>or</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="you@example.com"
          style={styles.input}
          value={email}
        />
        <AppButton
          title={isLoading ? "Sending link..." : "Send magic link"}
          onPress={handleSignIn}
          disabled={isLoading || isOauthLoading}
        />
        {isLoading || isOauthLoading ? <ActivityIndicator style={styles.spinner} /> : null}
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
  oauthMessage: {
    fontSize: 12,
    color: "#777",
    textAlign: "center"
  },
  orLabel: {
    textAlign: "center",
    color: "#888",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase"
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
