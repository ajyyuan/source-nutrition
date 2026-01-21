import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { CaptureScreen } from "../screens/CaptureScreen";
import { HomeScreen } from "../screens/HomeScreen";

export type RootStackParamList = {
  Home: undefined;
  Capture: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Capture" component={CaptureScreen} />
    </Stack.Navigator>
  );
}
