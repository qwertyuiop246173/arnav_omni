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
apiClient.interceptors.request.use(
    async (config) => {
        config.headers['ngrok-skip-browser-warning'] = 'true';
        return config;
    },
    error => Promise.reject(error)
);
apiClient.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return axios(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = tokenStorage.getString("refresh_token");
                if (!refreshToken) throw new Error("No refresh token");

                const response = await axios.post(`${BASE_URL}/auth/refresh-token`, {
                    refresh_token: refreshToken
                });

                if (response.data?.token) {
                    const newToken = response.data.token;
                    tokenStorage.set("token", newToken);
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    processQueue(null, newToken);
                    return axios(originalRequest);
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                tokenStorage.clearAll();
                Alert.alert(
                    "Session Expired",
                    "Please sign in again to continue",
                    [{
                        text: "OK",
                        onPress: () => router.replace('/role')
                    }]
                );
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
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