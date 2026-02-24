import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { CaptureScreen } from "../screens/CaptureScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { NutrientDetailScreen } from "../screens/NutrientDetailScreen";
import { FoodDetailScreen } from "../screens/FoodDetailScreen";
import { DiscoverScreen } from "../screens/DiscoverScreen";
import { SavedMealsScreen } from "../screens/SavedMealsScreen";

export type RootStackParamList = {
  MainTabs: undefined;
  NutrientDetail: { nutrientKey: string };
  FoodDetail: { canonicalId: string };
};

export type RootTabParamList = {
  Home: undefined;
  Capture: { mealId?: string } | undefined;
  History: undefined;
  Saved: undefined;
  Discover: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      id="root-tabs"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home-outline";
          if (route.name === "Capture") {
            iconName = "camera-outline";
          } else if (route.name === "History") {
            iconName = "calendar-outline";
          } else if (route.name === "Saved") {
            iconName = "bookmark-outline";
          } else if (route.name === "Discover") {
            iconName = "search-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#111",
        tabBarInactiveTintColor: "#777"
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Capture" component={CaptureScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Saved" component={SavedMealsScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator
      id="root-stack"
      screenOptions={{
        headerShown: false
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="NutrientDetail" component={NutrientDetailScreen} />
      <Stack.Screen name="FoodDetail" component={FoodDetailScreen} />
    </Stack.Navigator>
  );
}
