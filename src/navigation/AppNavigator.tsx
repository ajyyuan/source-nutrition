import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { CaptureScreen } from "../screens/CaptureScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { NutrientDetailScreen } from "../screens/NutrientDetailScreen";

export type RootStackParamList = {
  MainTabs: undefined;
  NutrientDetail: { nutrientKey: string };
};

export type RootTabParamList = {
  Home: undefined;
  Capture: { mealId?: string } | undefined;
  History: undefined;
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
    </Stack.Navigator>
  );
}
