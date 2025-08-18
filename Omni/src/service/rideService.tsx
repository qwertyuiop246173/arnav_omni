import { router } from "expo-router";
import { apiClient } from "./apiIntereptors"
import { Alert } from "react-native";
import { resetAndNavigate } from "@/utils/Helpers";
import { tokenStorage } from "@/store/storage";
import { UseWS } from "./WSProvider";

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


export const createRide = async (payload: RidePayload) => {
    try {
        // Validate token first
        const token = tokenStorage.getString('token');
        if (!token) {
            throw new Error('Authentication required');
        }

        // Validate payload
        if (!payload.fare || !payload.distance) {
            throw new Error('Fare and distance are required');
        }

        const response = await apiClient.post('/ride/create', {
            ...payload,
            fare: Math.round(payload.fare), // Ensure fare is a whole number
            distance: Number(payload.distance.toFixed(2)) // Format distance to 2 decimal places
        });

        if (!response.data?.ride) {
            throw new Error('Invalid response from server');
        }

        console.log('Ride created successfully:', response.data.ride);

        router.navigate({
            pathname: '/customer/liveride',
            params: {
                id: response.data.ride._id,
                status: response.data.ride.status
            }
        });

        return response.data.ride;
    } catch (error: any) {
        console.error('Create ride error:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });

        Alert.alert(
            "Error",
            error.response?.data?.msg || "Unable to create ride. Please try again."
        );
        return null;
    }
};

export const getMyRides = async (isCustomer: boolean = true) => {
    try {
        const token = tokenStorage.getString('token');
        const { accessToken } = UseWS();
        // console.log('Current token:', token?.substring(0, 20) + '...');
        console.log('Current token:',  accessToken);
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