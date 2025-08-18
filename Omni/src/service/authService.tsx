import axios from "axios"
import { BASE_URL } from "./config"
import { Alert } from 'react-native';
import { tokenStorage } from '@/store/storage';
import { useUserStore } from '@/store/userStore';
import { useRiderStore } from '@/store/riderStore';
import { resetAndNavigate } from '@/utils/Helpers';
import { apiClient } from './apiIntereptors';
// export const Signin = async (
//     payload: {
//         role: 'customer' | 'rider'
//         phone: string
//     },
//     updateAccessToken: () => void
// ) => {
//     const { setUser } = useUserStore.getState()
//     const { setUser: setRiderUser } = useRiderStore.getState()
//     try {
//         const res = await axios.post(`${BASE_URL}/auth/signin`, payload)
//         if (res.data.user.role === 'customer') {
//             setUser(res.data.user)
//         } else {
//             setRiderUser(res.data.user)
//         }
//         tokenStorage.set('access_token', res.data.access_token)
//         tokenStorage.set('refresh_token', res.data.refresh_token)
//         if (res.data.user.role === 'customer') {
//             resetAndNavigate('/customer/home')
//         } else {
//             resetAndNavigate('/rider/home')
//         }
//         updateAccessToken()
//         return res.data;
//     } catch (error: any) {
//         console.error("Full error object during sign in:", error);
//         // Prefer backend error message if available
//         const backendMsg = error?.response?.data?.msg;
//         if (backendMsg) {
//             throw new Error(backendMsg);
//         }
//         throw new Error(error.message || 'Failed to sign in. Please try again.');
//     }

// }




// export const Signin = async (
//     payload: { role: string; phone: string },
//     updateAccessToken: (token: string) => void
// ) => {
//     try {
//         console.log('Attempting signin with:', payload);
//         console.log('Using BASE_URL:', appAxios.defaults.baseURL);

//         const response = await appAxios.post('/auth/signin', payload, {
//             timeout: 10000, // 10 second timeout
//             headers: {
//                 'Content-Type': 'application/json'
//             }
//         });

//         if (response.data?.token) {
//             tokenStorage.set('token', response.data.token);
//             updateAccessToken(response.data.token);
//             return true;
//         }
//         throw new Error('Invalid response from server');

//     } catch (error: any) {
//         console.error('Detailed signin error:', {
//             message: error.message,
//             code: error?.code,
//             response: error?.response?.data,
//             config: error?.config?.url
//         });

//         const message = error.message === 'Network Error'
//             ? 'Cannot connect to server. Please check your internet connection.'
//             : error?.response?.data?.message || 'Sign in failed. Please try again.';

//         throw new Error(message);
//     }
// };

export const Signin = async (
    payload: { role: string; phone: string },
    updateAccessToken: (token: string) => void
) => {
    try {
        console.log('Signing in with:', payload);
        const response = await apiClient.post('/auth/signin', payload);
        console.log('Auth response:', response.data);

        if (!response.data?.token) {
            throw new Error('No token received from server');
        }

        // Store both tokens
        tokenStorage.set('token', response.data.token);
        tokenStorage.set('refresh_token', response.data.refresh_token);

        console.log('Tokens stored:', {
            hasToken: !!tokenStorage.getString('token'),
            hasRefreshToken: !!tokenStorage.getString('refresh_token')
        });

        // Update WebSocket connection
        updateAccessToken(response.data.token);
        return true;

    } catch (error: any) {
        console.error('Signin error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });

        Alert.alert(
            "Sign In Failed",
            error.response?.data?.msg || "Unable to sign in. Please try again."
        );
        return false;
    }
};


export const logout = async (disconnect?: () => void) => {
    if (disconnect) {
        disconnect()
    }

    const { clearData } = useUserStore.getState();
    const { clearRiderData } = useRiderStore.getState();

    tokenStorage.clearAll();
    clearRiderData();
    clearData();
    resetAndNavigate('/role');
};

