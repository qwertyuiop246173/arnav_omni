import { View, Text, Image, Alert } from 'react-native'
import React, { useEffect, useState } from 'react'
import { commonStyles } from '../styles/commonStyles'
import { splashStyles } from '../styles/splashStyles'
import CustomText from '../components/shared/customText'
import { useUserStore } from '../store/userStore'
import { tokenStorage } from '../store/storage'
import { refresh_token } from '../service/apiIntereptors'
import { resetAndNavigate } from '../utils/Helpers'
import * as  jwtDecode  from 'jwt-decode'
import { logout } from '../service/authService'



interface DecodedToken {
    exp: number;
}
const Main = () => {
    const [loaded] = useState({
        Bold: require('@/assets/fonts/NotoSans-Bold.ttf'),
        Regular: require('@/assets/fonts/NotoSans-Regular.ttf'),
        Medium: require('@/assets/fonts/NotoSans-Medium.ttf'),
        Light: require('@/assets/fonts/NotoSans-Light.ttf'),
        SemiBold: require('@/assets/fonts/NotoSans-SemiBold.ttf'),
    })

    const { user } = useUserStore()
    const [hasNavigated, setHasNavigated] = useState(false)
    const tokenCheck = async () => {
        const access_token = tokenStorage.getString('access_token') as string
        const refresh_tokenStr = tokenStorage.getString('refresh_token') as string
        if (access_token) {
            const decodedAccessToken = jwtDecode.jwtDecode<DecodedToken>(access_token);
            const decodedRefreshToken = jwtDecode.jwtDecode<DecodedToken>(refresh_tokenStr);
            const currentTime = Date.now() / 1000; // Current time in seconds
            if (decodedRefreshToken?.exp < currentTime) {
                logout()
                Alert.alert('Session expired', 'Please login again to continue.')
            }

            if (decodedAccessToken?.exp < currentTime) {
                try {
                    refresh_token();

                } catch (error) {
                    console.error('Error refreshing token:', error);
                    Alert.alert('Refresh Token Error')
                }
            }

            if (user) {
                resetAndNavigate('/customer/home')
            } else {
                resetAndNavigate('/rider/home')
            }
            return;
        }
        resetAndNavigate('/role')
    }
    useEffect(() => {
        if (loaded && !hasNavigated) {
            const timeoutId = setTimeout(() => {
                tokenCheck()
                setHasNavigated(true)
            }, 1000);
            return () => clearTimeout(timeoutId);
        }
    }, [loaded, hasNavigated, user]);

    return (
        <View style={commonStyles.container}>
            <Image
                source={require('@/assets/images/logo_t.png')}
                style={splashStyles.img} />
            <CustomText variant='h5' fontFamily='Medium' style={splashStyles.text}>Made in 🇮🇳</CustomText>
        </View>
    )
}

export default Main