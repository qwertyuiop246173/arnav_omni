import {
    View,
    Text,
    Image,
    Pressable, // Use Pressable for better feedback
    StyleSheet,
    SafeAreaView, // Use SafeAreaView for better layout on all devices
    StatusBar
} from 'react-native'
import React from 'react'
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons'; // Import an icon set

const Role = () => {
    const handleCustomerPress = () => {
        router.push('/customer/auth');
    }
    const handleRiderPress = () => {
        router.push('/rider/auth');
    }
    return (
        <SafeAreaView style={styles.wrapper}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>
                <Image source={require('@/assets/images/logo_t.png')} style={styles.logo} />
                <Text style={styles.title}>Choose your role</Text>
                <Text style={styles.subtitle}>How will you be using our app today?</Text>

         
                <Pressable
                    style={({ pressed }) => [
                        styles.card,
                        pressed && styles.cardPressed // Apply style when pressed
                    ]}
                    onPress={handleCustomerPress}
                >
                    <Image source={require('@/assets/images/customer.jpg')} style={styles.image} />
                    <View style={styles.textContainer}>
                        <Text style={styles.cardTitle}>Customer</Text>
                        <Text style={styles.cardDescription}>Book a ride to your destination.</Text>
                    </View>
                    <Feather name="chevron-right" size={24} color="#555" />
                </Pressable>

                {/* Rider Card */}
                <Pressable
                    style={({ pressed }) => [
                        styles.card,
                        pressed && styles.cardPressed
                    ]}
                    onPress={handleRiderPress}
                >
                    <Image source={require('@/assets/images/rider.jpg')} style={styles.image} />
                    <View style={styles.textContainer}>
                        <Text style={styles.cardTitle}>Rider</Text>
                        <Text style={styles.cardDescription}>Earn money by giving rides.</Text>
                    </View>
                    <Feather name="chevron-right" size={24} color="#555" />
                </Pressable>
            </View>
        </SafeAreaView>
    )
}

// Styles are now included directly in the file for clarity
const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: '#f7f8fa', // A light, neutral background color
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    logo: {
        width: 150,
        height: 150,
        resizeMode: 'contain',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 40,
        textAlign: 'center',
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 15,
        width: '100%',
        marginBottom: 20,
        // Shadow for iOS
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        // Shadow for Android
        elevation: 5,
    },
    cardPressed: {
        transform: [{ scale: 0.98 }], // Scale down effect on press
    },
    image: {
        width: 60,
        height: 60,
        borderRadius: 30, // Make images circular
        marginRight: 15,
    },
    textContainer: {
        flex: 1, // Allows the text to take up available space
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600', // Semi-bold
        color: '#34495e',
    },
    cardDescription: {
        fontSize: 14,
        color: '#95a5a6',
        marginTop: 4,
    },
});

export default Role;