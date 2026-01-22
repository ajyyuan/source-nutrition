import { useEffect, useState } from "react";
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
