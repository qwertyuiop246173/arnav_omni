import { View, Text, Alert } from 'react-native'
import React, { use, useEffect, useState } from 'react'
import { useRiderStore } from '@/store/riderStore';
import { UseWS } from '@/service/WSProvider';
import { useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import { resetAndNavigate } from '@/utils/Helpers';
import { rideStyles } from '@/styles/rideStyles';
import { StatusBar } from 'expo-status-bar';
import RiderLiveTracking from '@/components/Rider/RiderLiveTracking';
import RiderActionButton from '@/components/Rider/RiderActionButton';
import { updateRideStatus } from '@/service/rideService';
import OtpInputModal from '@/components/Rider/OtpInputModal';
const LiveRide = () => {
    const [isOtpModalVisible, setIsOtpModalVisible] = useState(false);
    const { setLocation, location, setOnDuty } = useRiderStore()
    const { emit, on, off } = UseWS()
    const [rideData, setRideData] = useState<any>(null)
    const route = useRoute() as any
    const params = route?.params || {}
    const id = params.id

    useEffect(() => {
        let locationSubscription: any
        const startLocationUpdates = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync()
            if (status === 'granted') {
                locationSubscription = Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 5000,
                        distanceInterval: 200
                    },
                    (location) => {
                        const { latitude, longitude, heading } = location.coords
                        setLocation({
                            latitude: latitude,
                            longitude: longitude,
                            address: "Somewhere",
                            heading: heading as number
                        })
                        setOnDuty(true)

                        emit("goOnDuty", {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                            heading: heading as number
                        })

                        emit("updateLocation", {
                            latitude,
                            longitude,
                            heading
                        })
                        console.log(`Location updated: Lat ${latitude}, Lon ${longitude}, Heading ${heading}`

                        )
                    }
                )
            } else {
                console.log("Location permission not granted")
            }
        }

        startLocationUpdates()
        return () => {
            if (locationSubscription) {
                locationSubscription.remove()
            }
        }
    }, [id])

    useEffect(() => {
        if (id) {
            emit('subscribeRide', id)

            on('rideData', (data) => {
                setRideData(data)
            })

            on('rideCancelled', (error) => {
                console.log("Ride cancelled:", error)
                resetAndNavigate('/rider/home')
                Alert.alert("Ride Cancelled", error.message || "The ride has been cancelled by the rider.")
            })

            on('rideUpdate', (data) => {
                setRideData(data)
            })

            on('error', (error) => {
                console.log("Ride error:", error)
                resetAndNavigate('/rider/home')
                Alert.alert("Error", error.message || "An error occurred.")
            })

        }

        return () => {
            off('rideData')
            off('error')
        }
    }, [id, emit, on, off])


    return (
        <View style={rideStyles.container}>
            <StatusBar style="light" backgroundColor='orange' translucent={false} />

            {rideData && (
                <RiderLiveTracking
                    status={rideData?.status}
                    drop={{
                        latitude: parseFloat(rideData?.drop.latitude),
                        longitude: parseFloat(rideData?.drop?.longitude)
                    }}
                    pickup={{
                        latitude: parseFloat(rideData?.pickup.latitude),
                        longitude: parseFloat(rideData?.pickup?.longitude)
                    }}
                    rider={{
                        latitude: location?.latitude,
                        longitude: location?.longitude,
                        heading: location?.heading
                    }}
                />
            )}
            <RiderActionButton
                ride={rideData}
                title={
                    rideData?.status === "START"
                        ? "ARRIVED"
                        : rideData?.status === "ARRIVED"
                            ? "COMPLETED"
                            : "SUCCESS"
                }
                onPress={async () => {
                    if (rideData?.status === "START") {
                        setIsOtpModalVisible(true)
                        return
                    }
                    const isSuccess = await updateRideStatus(rideData?.id, 'COMPLETED')
                    if (isSuccess) {
                        Alert.alert("Ride Completed", "The ride has been successfully completed.")
                        resetAndNavigate('/rider/home')
                    }
                    else {
                        Alert.alert("Error", "Failed to complete the ride. Please try again.")
                    }
                }}
                color='#228B22'
            />

            {isOtpModalVisible && (
                <OtpInputModal
                    visible={isOtpModalVisible}
                    onClose={() => setIsOtpModalVisible(false)}
                    title="Enter OTP"
                    onConfirm={async (otp) => {
                        if (otp === rideData?.otp) {
                            const isSuccess = await updateRideStatus(rideData?.id, 'ARRIVED')
                            if (isSuccess) {
                                setIsOtpModalVisible(false);
                                console.log("OTP entered:", otp);
                            } else {
                                Alert.alert("Error", "Failed to verify OTP. Please try again.");
                            }


                        } else {
                            Alert.alert("Error", "Invalid OTP. Please try again.");
                        }
                    }}
                />
            )}
        </View>
    )
}

export default LiveRide