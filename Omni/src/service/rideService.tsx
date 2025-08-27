import { router } from "expo-router";
import { apiClient } from "./apiIntereptors"
import { Alert } from "react-native";
import { resetAndNavigate } from "@/utils/Helpers";
import { tokenStorage } from "@/store/storage";
import { UseWS } from "./WSProvider";
import { BASE_URL } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
interface coords {
    address: string,
    latitude: number,
    longitude: number
}
interface RidePayload {
    vehicle: "bike" | "auto" | "cabEconomy" | "cabPremium",
    pickup: coords,
    drop: coords,
    fare: number,
    distance: number
}

// export const createRide = async (payload: {
//     vehicle: "bike" | "auto" | "cabEconomy" | "cabPremium",
//     pickup: coords,
//     drop: coords
// }) => {
//     try {
//         const res = await apiClient.post('/ride/create', payload);
//         router?.navigate({
//             pathname: '/customer/liveride',
//             params: {
//                 id: res?.data?.ride?._id
//             }
//         })
//     } catch (error: any) {
//         Alert.alert("oh no!", "Something went wrong in creating rides, please try again later.")
//         console.error("Error creating ride:", error);

//     }
// }


export const createRide = async (payload: any) => {
    console.log('[rideService] createRide payload:', payload);

    // Ensure apiClient has Authorization header set if possible
    try {
        let storedToken: string | null | undefined = undefined;
        try {
            storedToken = (tokenStorage && typeof (tokenStorage as any).getString === 'function')
                ? (tokenStorage as any).getString('token')
                : undefined;
        } catch { /* ignore */ }

        if (!storedToken) {
            storedToken = await AsyncStorage.getItem('token');
        }

        if (storedToken) {
            console.log('[rideService] attaching token to apiClient');
            apiClient.defaults.headers = apiClient.defaults.headers || {};
            (apiClient.defaults.headers as any).Authorization = `Bearer ${storedToken}`;
        } else {
            console.log('[rideService] no token found in storage before createRide');
        }
    } catch (e) {
        console.warn('[rideService] token attach attempt failed', e);
    }

    // try likely endpoints
    const endpoints = ['/ride/create', '/ride'];
    let lastErr: any = null;
    for (const ep of endpoints) {
        try {
            const res = await apiClient.post(ep, payload);
            console.log('[rideService] response status:', res.status, 'data:', res.data);
            return res.data;
        } catch (e: any) {
            console.warn('[rideService] endpoint failed', ep, e?.response?.status || e.message);
            lastErr = e;
            const status = e?.response?.status;
            if (status && status !== 404) throw e;
        }
    }
    const finalErr: any = new Error('Failed to create ride');
    finalErr.data = lastErr;
    throw finalErr;
};
export const getRide = async (id: string) => {
    console.log('[rideService] getRide id:', id);
    const candidatePaths = [
        `/ride/${id}`,
        `/ride/get/${id}`,
        `/ride/find/${id}`,
        `/ride/details/${id}`,
    ];
    try {
        // try direct candidate paths first
        for (const path of candidatePaths) {
            try {
                console.log('[rideService] trying GET', path);
                const res = await apiClient.get(path);
                console.log('[rideService] getRide status:', res.status, 'data:', res.data);
                if (res.data) {
                    // normalize to { ride: ... } shape
                    if (res.data.ride) return res.data;
                    return { ride: res.data };
                }
            } catch (err: any) {
                console.warn('[rideService] path failed', path, err?.response?.data?.message || err?.message || err);
                // if 404 try next
                const status = err?.response?.status;
                if (status && status !== 404) throw err;
            }
        }

        // try query param style as a last attempt
        try {
            console.log('[rideService] trying GET /ride?id= query');
            const res = await apiClient.get(`/ride`, { params: { id } });
            console.log('[rideService] getRide (query) status:', res.status, 'data:', res.data);
            if (res.data) {
                if (res.data.ride) return res.data;
                return { ride: res.data };
            }
        } catch (err: any) {
            console.warn('[rideService] query style failed', err?.response?.data?.message || err?.message || err);
            const status = err?.response?.status;
            if (status && status !== 404) throw err;
        }

        // nothing worked
        const err: any = new Error('Route does not exist for fetching ride');
        err.status = 404;
        throw err;
    } catch (err: any) {
        console.error('[rideService] getRide error', err?.response?.data || err.message || err);
        throw err;
    }
};
export const getMyRides = async (isCustomer: boolean = true) => {
    try {
        const token = tokenStorage.getString('token');
        const { accessToken } = UseWS();
        // console.log('Current token:', token?.substring(0, 20) + '...');
        console.log('Current token:', accessToken);
        // const refreshToken = tokenStorage.getString('refresh_token');

        if (!token) {
            console.log('No token found, redirecting to auth...');
            router.replace('/role');
            return;
        }

        const res = await apiClient.get('/ride/rides');
        console.log('Rides response:', res.data);
        // Validate response data
        if (!res?.data) {
            throw new Error('Invalid response from server');
        }

        const rides = res.data.rides || [];
        console.log('Rides received:', rides.length);

        const filterRides = rides.filter((ride: any) => {
            if (!ride?._id || !ride?.status) {
                console.warn('Invalid ride data:', ride);
                return false;
            }
            return ride.status !== 'COMPLETED';
        });

        if (filterRides.length > 0) {
            router.navigate({
                pathname: isCustomer ? "/customer/liveride" : "/rider/liveride",
                params: {
                    id: filterRides[0]._id,
                    status: filterRides[0].status
                }
            });
        } else {
            console.log('No active rides found');
        }
    } catch (error: any) {
        console.error('GetMyRides Error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });

        if (error.response?.status === 401) {
            tokenStorage.clearAll();
            router.replace('/role');
        }
    }
};
// export const getMyRides = async (isCustomer: boolean = true) => {
//     try {
//         const token = tokenStorage.getString('token');
//         if (!token) {
//             router.replace('/role');
//             return;
//         }

//         const res = await apiClient.get('/ride/rides');
//         const filterRides = res.data.rides?.filter((ride: any) => ride?.status !== 'COMPLETED');

//         if (filterRides?.length > 0) {
//             router.navigate({
//                 pathname: isCustomer ? "/customer/liveride" : "/rider/liveride",
//                 params: {
//                     id: filterRides[0]._id,
//                 }
//             });
//         }
//     } catch (error: any) {
//         console.error("GetMyRides Error:", error.response?.data || error.message);

//         if (error.response?.status === 401) {

//             Alert.alert("Session Expired", "Please login again");
//             router.replace('/role');
//         } else {
//             Alert.alert(
//                 "Error",
//                 "Unable to fetch rides. Please try again later."
//             );
//         }
//     }
// }

// export const getMyRides = async (isCustomer: boolean = true) => {
//     try {
//         const res = await appAxios.get('/ride/rides')
//         const filterRides = res.data.rides?.filter((ride: any) => ride?.status != 'COMPLETED')
//         if (filterRides?.length > 0) {
//             router?.navigate({
//                 pathname: isCustomer ? "/customer/liveride" : "/rider/liveride",
//                 params: {
//                     id: filterRides![0]?._id,
//                 }
//             })
//         }
//     } catch (error: any) {
//         Alert.alert("oh no!", "Something went wrong, please try again later.")
//         console.log("Error:GET MY Ride", error)
//     }
// }

export const acceptRideOffer = async (rideId: string) => {
    try {
        const res = await apiClient.patch(`/ride/accept/${rideId}`)
        resetAndNavigate({
            pathname: "/rider/liveride",
            params: { id: rideId }
        })
    } catch (error: any) {
        Alert.alert("oh no!", "Something went wrong, please try again later.")
        console.log(error)
    }
}


export const updateRideStatus = async (rideId: string, status: string) => {
    try {
        const res = await apiClient.patch(`/ride/update/${rideId}`, { status })
        return true
    } catch (error: any) {
        Alert.alert("oh no!", "Something went wrong, please try again later.")
        console.log(error)
        return false
    }
}

export const cancelRide = async (rideId: string) => {
  if (!rideId) throw new Error('rideId required')
  return apiClient.post(`/ride/${rideId}/cancel`)
}