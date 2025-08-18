import { View, Text } from 'react-native'
import React from 'react'
import { Stack } from 'expo-router'
import { gestureHandlerRootHOC } from 'react-native-gesture-handler';
import { WSProvider } from '@/service/WSProvider';

const RootLayout = () => {
    return (
        <WSProvider>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="role" />
                <Stack.Screen name="customer/setlocation" />
                <Stack.Screen name="customer/ridebooking" />
                <Stack.Screen name="customer/home" />
                <Stack.Screen name="customer/auth" />
                <Stack.Screen name="rider/auth" />
                <Stack.Screen name="rider/home" />
                <Stack.Screen name="customer/liveride" />
                <Stack.Screen name="rider/liveride" />
            </Stack>
        </WSProvider>
    )
}

export default gestureHandlerRootHOC(RootLayout)