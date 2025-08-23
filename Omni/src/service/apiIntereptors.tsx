// import axios from "axios";
// import { BASE_URL } from "./config";
// import { tokenStorage } from "../store/storage";
// import { clearAuthAndLogout } from "./authUtils";


// export const refresh_token = async () => {
//     try {
//         const refreshToken = tokenStorage.getString("refresh_token");
//         const response = await axios.post(`${BASE_URL}/auth/refresh-token`, {
//             refreshToken: refreshToken
//         });

//         const new_access_token = response.data.access_token;
//         const new_refresh_token = response.data.refresh_token;

//         tokenStorage.set("access_token", new_access_token);
//         tokenStorage.set("refresh_token", new_refresh_token);

//         return new_access_token;
//     } catch (error) {
//         console.error("Error refreshing token:", error);
//         clearAuthAndLogout();
//         tokenStorage.clearAll()
//         return null;
//     }
// }

// export const appAxios = axios.create({
//     baseURL: BASE_URL,
//     timeout: 10000,
//     headers: {
//         'Content-Type': 'application/json'
//     }
// })

// // appAxios.interceptors.request.use(
// //     (response) => response,
// //     async (error) => {
// //         if (error.response && error.response.status === 401) {
// //             // Handle unauthorized access, e.g., refresh token or logout
// //             try {
// //                 const newAccessToken = await refresh_token();
// //                 if (newAccessToken) {
// //                     error.config.headers.Authorization = `Bearer ${newAccessToken}`;
// //                     return axios(error.config);
// //                 }
// //             } catch (error) {
// //                 console.error("Error in request interceptor:", error);
// //             }
// //         }
// //         return Promise.reject(error);
// //     }

// // );
// // Add request interceptor with better error handling
// appAxios.interceptors.request.use(
//     async (config) => {
//         console.log('Making request to:', `${config.baseURL}${config.url}`);
//         const token = tokenStorage.getString("token");
//         if (token) {
//             config.headers.Authorization = `Bearer ${token}`;
//         }
//         return config;
//     },
//     error => Promise.reject(error)
// );

// // Fix response interceptor
// appAxios.interceptors.response.use(
//     response => response,
//     async (error) => {
//         console.error('API Error:', {
//             url: error.config?.url,
//             method: error.config?.method,
//             status: error.response?.status,
//             data: error.response?.data
//         });

//         if (error.response?.status === 401) {
//             try {
//                 const newToken = await refresh_token();
//                 if (newToken) {
//                     error.config.headers.Authorization = `Bearer ${newToken}`;
//                     return axios(error.config);
//                 }
//             } catch (refreshError) {
//                 clearAuthAndLogout();
//             }
//         }
//         return Promise.reject(error);
//     }
// );
import axios, { InternalAxiosRequestConfig } from "axios";
import { BASE_URL } from "./config";
import { tokenStorage } from "../store/storage";
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { clearAuthAndLogout } from "./authUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

export const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        "ngrok-skip-browser-warning": "true", // <-- Add this header
        "Accept": "application/json, text/plain, */*"
    }
});

// apiClient.interceptors.request.use(
//     async (config) => {
//         const token = tokenStorage.getString("token");
//         if (token) {
//             config.headers.set('Authorization', `Bearer ${token}`);
//         }
//         console.log('Request details:', {
//             url: config.url,
//             method: config.method,
//             hasToken: !!token,
//             headers: config.headers
//         });
//         return config;
//     },
//     error => Promise.reject(error)
// );
apiClient.interceptors.request.use(async (config) => {
    try {
        const token =
            (tokenStorage as any)?.getString?.('access_token') ||
            (tokenStorage as any)?.getString?.('accessToken') ||
            (tokenStorage as any)?.getString?.('token') ||
            (await AsyncStorage.getItem('accessToken')) ||
            (await AsyncStorage.getItem('token')) ||
            null

        console.log('[apiInterceptors] attaching token present=', !!token)
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`
        }
    } catch (e) {
        console.warn('[apiInterceptors] token attach failed', e)
    }
    return config
})

// response interceptor: attempt refresh only if refresh token exists, otherwise reject with auth error
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error?.response?.status;

        // only handle 401 once per request
        if (status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // try to get refresh token
            let refreshToken: string | null = null;
            try {
                if (tokenStorage && typeof tokenStorage.getString === 'function') {
                    refreshToken = tokenStorage.getString('refresh_token') || null;
                }
            } catch { /* ignore */ }
            if (!refreshToken) {
                try { refreshToken = await AsyncStorage.getItem('refresh_token'); } catch (e) { /* ignore */ }
            }

            // no refresh token -> clear auth storage and reject with auth-required error
            if (!refreshToken) {
                try {
                    await AsyncStorage.removeItem('token');
                    await AsyncStorage.removeItem('refresh_token');
                    await AsyncStorage.removeItem('user');
                    if (tokenStorage && typeof tokenStorage.delete === 'function') {
                        try { tokenStorage.delete('token'); tokenStorage.delete('refresh_token'); } catch { }
                    }
                } catch (e) { /* ignore */ }
                const authErr = new Error('Authentication required');
                authErr.name = 'AUTH_REQUIRED';
                return Promise.reject(authErr);
            }

            // refresh token exists -> attempt refresh
            try {
                const resp = await axios.post(`${BASE_URL.replace(/\/$/, '')}/auth/refresh-token`, { refresh_token: refreshToken }, { timeout: 15000 });
                const newAccess = resp.data?.access_token || resp.data?.token || resp.data?.accessToken;
                const newRefresh = resp.data?.refresh_token || resp.data?.refreshToken;

                if (newAccess) {
                    // persist
                    try { await AsyncStorage.setItem('token', newAccess); } catch { }
                    try { tokenStorage && typeof tokenStorage.set === 'function' && tokenStorage.set('token', newAccess); } catch { }
                    if (newRefresh) {
                        try { await AsyncStorage.setItem('refresh_token', newRefresh); } catch { }
                        try { tokenStorage && typeof tokenStorage.set === 'function' && tokenStorage.set('refresh_token', newRefresh); } catch { }
                    }

                    // retry original request with new token
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers.Authorization = `Bearer ${newAccess}`;
                    return apiClient(originalRequest);
                }
            } catch (refreshErr) {
                // refresh failed -> clear auth and reject with auth-required
                try {
                    await AsyncStorage.removeItem('token');
                    await AsyncStorage.removeItem('refresh_token');
                    await AsyncStorage.removeItem('user');
                } catch (e) { }
                const authErr = new Error('Authentication required');
                authErr.name = 'AUTH_REQUIRED';
                return Promise.reject(authErr);
            }
        }

        return Promise.reject(error);
    }
);
export const refresh_token = async () => {
    try {
        const refreshToken = tokenStorage.getString("refresh_token");
        const response = await axios.post(`${BASE_URL}/auth/refresh-token`, {
            refreshToken: refreshToken
        });

        const new_access_token = response.data.access_token;
        const new_refresh_token = response.data.refresh_token;

        tokenStorage.set("access_token", new_access_token);
        tokenStorage.set("refresh_token", new_refresh_token);

        return new_access_token;
    } catch (error) {
        console.error("Error refreshing token:", error);
        clearAuthAndLogout();
        tokenStorage.clearAll()
        return null;
    }
}