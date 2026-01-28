import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { CaptureScreen } from "../screens/CaptureScreen";
import { HistoryScreen } from "../screens/HistoryScreen";
import { HomeScreen } from "../screens/HomeScreen";

export type RootTabParamList = {
  Home: undefined;
  Capture: { mealId?: string } | undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export function AppNavigator() {
  return (
    <Tab.Navigator id="root-tabs">
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Capture" component={CaptureScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}
