import { useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";

import { AppNavigator } from "./src/navigation/AppNavigator";
import { AuthScreen } from "./src/screens/AuthScreen";
import { ConfigScreen } from "./src/screens/ConfigScreen";
import { hasSupabaseConfig, supabase } from "./src/lib/supabase";
import type { Session } from "@supabase/supabase-js";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleDeepLink = useMemo(
    () => async (url: string | null) => {
      if (!url) {
        return;
      }

      const [base, hash = ""] = url.split("#");
      const queryString = base.includes("?") ? base.split("?")[1] : "";

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

      const queryParams = queryString ? parseParams(queryString) : {};
      const hashParams = hash ? parseParams(hash) : {};

      const authCode = queryParams.code;
      const accessToken = hashParams.access_token;
      const refreshToken = hashParams.refresh_token;

      if (authCode) {
        await supabase.auth.exchangeCodeForSession(authCode);
        return;
      }

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
      }
    },
    []
  );

  useEffect(() => {
    let isMounted = true;

    if (!hasSupabaseConfig) {
      setIsLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }
      if (error) {
        setSession(null);
      } else {
        setSession(data.session ?? null);
      }
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }
      setSession(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      return;
    }

    Linking.getInitialURL().then(handleDeepLink);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {isLoading ? null : hasSupabaseConfig ? (
        session ? (
          <AppNavigator />
        ) : (
          <AuthScreen />
        )
      ) : (
        <ConfigScreen />
      )}
    </NavigationContainer>
  );
}
