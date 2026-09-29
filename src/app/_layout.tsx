import { Stack } from 'expo-router';

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { BloqueioBiometrico } from '../app/Bloqueiobiometrico';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BloqueioBiometrico>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </BloqueioBiometrico>
    </GestureHandlerRootView>
  );
}