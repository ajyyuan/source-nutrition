import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import type { RootTabParamList } from "../navigation/AppNavigator";
import foodProfiles from "../data/foodProfiles.json";

type DiscoverProps = CompositeScreenProps<
  BottomTabScreenProps<RootTabParamList, "Discover">,
  NativeStackScreenProps<RootStackParamList>
>;

type FoodProfile = {
  display_name: string;
  per_100g: Record<string, number>;
};

const profiles = foodProfiles as Record<string, FoodProfile>;

const FOOD_ENTRIES = Object.entries(profiles).map(([canonicalId, profile]) => ({
  canonicalId,
  displayName: profile.display_name
}));

export function DiscoverScreen({ navigation }: DiscoverProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...FOOD_ENTRIES].sort((a, b) => a.displayName.localeCompare(b.displayName));
    return FOOD_ENTRIES.filter(({ displayName }) =>
      displayName.toLowerCase().includes(q)
    ).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [query]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search foods..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search foods"
          />
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.canonicalId}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("FoodDetail", { canonicalId: item.canonicalId })}
            style={({ pressed }) =>
              pressed ? [styles.foodRow, styles.foodRowPressed] : styles.foodRow
            }
            accessibilityRole="button"
            accessibilityLabel={`View ${item.displayName} micronutrient profile`}
          >
            <Text style={styles.foodName}>{item.displayName}</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {query.trim() ? "No foods match your search." : "No foods in database."}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff"
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee"
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 12
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111",
    paddingVertical: 10,
    paddingRight: 8
  },
  listContent: {
    padding: 16,
    paddingBottom: 32
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    marginBottom: 6
  },
  foodRowPressed: {
    opacity: 0.7
  },
  foodName: {
    fontSize: 15,
    color: "#333",
    flex: 1
  },
  empty: {
    paddingVertical: 32,
    alignItems: "center"
  },
  emptyText: {
    fontSize: 15,
    color: "#666"
  }
});
