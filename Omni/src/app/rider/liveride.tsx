import { View, Text, Alert, Platform, ToastAndroid } from 'react-native'
import React, { use, useCallback, useEffect, useRef, useState } from 'react'
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
import { router } from 'expo-router';

const LiveRide = () => {
    const [isOtpModalVisible, setIsOtpModalVisible] = useState(false);
    const { setLocation, location, setOnDuty } = useRiderStore()
    const { emit, on, off } = UseWS()
    const [rideData, setRideData] = useState<any>(null)
    const route = useRoute() as any
    const params = route?.params || {}
    const id = route?.params?.id
    const cancelledRef = useRef(false)
    const rideId = id ?? (rideData?._id ?? rideData?.id)
    const bottomSheetRef = useRef<any>(null)
    // computed state: distance from rider -> pickup and whether rider can mark ARRIVED
    const [pickupDistance, setPickupDistance] = useState<number | null>(null)
    const [canArrive, setCanArrive] = useState<boolean>(false)
    const ARRIVE_THRESHOLD_METERS = 200
    const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const toRad = (v: number) => (v * Math.PI) / 180
        const R = 6371000
        const dLat = toRad(lat2 - lat1)
        const dLon = toRad(lon2 - lon1)
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }


    // safe parse helper to avoid NaN / undefined issues
    const parseCoord = (v: any) => {
        if (v === null || v === undefined) return 0
        const n = typeof v === 'number' ? v : parseFloat(String(v))
        return Number.isFinite(n) ? n : 0
    }

    // useEffect(() => {
    //     try {
    //         if (rideData?.pickup && location?.latitude != null && location?.longitude != null) {
    //             const pLat = Number(rideData.pickup.latitude ?? rideData.pickup.lat ?? 0)
    //             const pLng = Number(rideData.pickup.longitude ?? rideData.pickup.lng ?? 0)
    //             const rLat = Number(location.latitude)
    //             const rLng = Number(location.longitude)
    //             const dist = distanceMeters(rLat, rLng, pLat, pLng)
    //             setPickupDistance(dist)
    //             setCanArrive(dist <= ARRIVE_THRESHOLD_METERS)
    //             console.log('[LiveRide] pickupDistance (m)=', dist, 'canArrive=', dist <= ARRIVE_THRESHOLD_METERS)
    //         } else {
    //             setPickupDistance(null)
    //             setCanArrive(false)
    //         }
    //     } catch (e) {
    //         console.warn('[LiveRide] compute pickup distance failed', e)
    //         setPickupDistance(null)
    //         setCanArrive(false)
    //     }
    // }, [rideData?.pickup, location?.latitude, location?.longitude])
    useEffect(() => {
        try {
            if (rideData?.pickup && location?.latitude != null && location?.longitude != null) {
                const pLat = Number(rideData.pickup.latitude ?? rideData.pickup.lat ?? 0)
                const pLng = Number(rideData.pickup.longitude ?? rideData.pickup.lng ?? 0)
                const rLat = Number(location.latitude)
                const rLng = Number(location.longitude)
                const dist = distanceMeters(rLat, rLng, pLat, pLng)
                setPickupDistance(dist)
                setCanArrive(dist <= ARRIVE_THRESHOLD_METERS)
                console.log('[LiveRide] pickupDistance (m)=', dist, 'canArrive=', dist <= ARRIVE_THRESHOLD_METERS)
            } else {
                setPickupDistance(null)
                setCanArrive(false)
            }
        } catch (e) {
            console.warn('[LiveRide] compute pickup distance failed', e)
            setPickupDistance(null)
            setCanArrive(false)
        }
    }, [rideData?.pickup, location?.latitude, location?.longitude])

    // useEffect(() => {
    //     let locationSubscription: any
    //     const startLocationUpdates = async () => {
    //         const { status } = await Location.requestForegroundPermissionsAsync()
    //         if (status === 'granted') {
    //             locationSubscription = Location.watchPositionAsync(
    //                 {
    //                     accuracy: Location.Accuracy.High,
    //                     timeInterval: 5000,
    //                     distanceInterval: 200
    //                 },
    //                 (location) => {
    //                     const { latitude, longitude, heading } = location.coords
    //                     setLocation({
    //                         latitude: latitude,
    //                         longitude: longitude,
    //                         address: "Somewhere",
    //                         heading: heading as number
    //                     })
    //                     setOnDuty(true)

    //                     emit("goOnDuty", {
    //                         latitude: location.coords.latitude,
    //                         longitude: location.coords.longitude,
    //                         heading: heading as number
    //                     })

    //                     emit("updateLocation", {
    //                         latitude,
    //                         longitude,
    //                         heading
    //                     })
    //                     console.log(`Location updated: Lat ${latitude}, Lon ${longitude}, Heading ${heading}`

    //                     )
    //                 }
    //             )
    //         } else {
    //             console.log("Location permission not granted")
    //         }
    //     }

    //     startLocationUpdates()
    //     return () => {
    //         if (locationSubscription) {
    //             locationSubscription.remove()
    //         }
    //     }
    // }, [id])
    useEffect(() => {
        let locationSubscription: any
        const startLocationUpdates = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync()
            if (status === 'granted') {
                locationSubscription = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 5000,
                        distanceInterval: 200
                    },
                    (pos) => {
                        const { latitude, longitude, heading } = pos.coords
                        setLocation({
                            latitude,
                            longitude,
                            address: location?.address ?? 'Current location',
                            heading: heading as number
                        })
                        setOnDuty(true)

                        try {
                            emit && emit('goOnDuty', {
                                latitude,
                                longitude,
                                heading: heading as number
                            })
                            emit && emit('updateLocation', { latitude, longitude, heading })
                        } catch (e) {
                            console.warn('[LiveRide] emit location failed', e)
                        }

                        console.log(`[LiveRide] Location updated: Lat ${latitude}, Lon ${longitude}, Heading ${heading}`)
                    }
                )
            } else {
                console.log('[LiveRide] Location permission not granted')
            }
        }

        startLocationUpdates()
        return () => {
            if (locationSubscription) {
                locationSubscription.remove()
            }
        }
        // id intentionally omitted from deps for continuous updates while mounted
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const handleRideUpdate = useCallback((data: any) => {
        const incoming = data?.ride ?? data
        const incomingId = String(incoming?._id ?? incoming?.rideId ?? incoming?.id)
        if (!incomingId || incomingId !== String(rideId)) return
        if (cancelledRef.current) {
            console.log('[LiveRide] ignored rideUpdate after cancel/unsubscribe', incomingId)
            return
        }
        console.log('[LiveRide] socket rideUpdate received', incoming)
        // ignore updates if local state indicates cancel
        if (String(incoming?.status ?? '').toUpperCase() === 'CANCELLED' || String(incoming?.status ?? '').toUpperCase() === 'NO_RIDER_ALLOTTED') {
            // close searching UI, navigate to home and show a short toast instead of alert
            try { bottomSheetRef.current?.snapToIndex?.(0) } catch (e) { }
            cancelledRef.current = true
            setRideData(incoming)
            try {
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Ride cancelled', ToastAndroid.SHORT)
                } else {
                    console.log('[LiveRide] Ride cancelled - navigate to home')
                }
            } catch (e) { console.warn('[LiveRide] toast failed', e) }
            router.replace('/rider/home')
            return
        }
        setRideData(incoming)
    }, [rideId])

    const handleNoRider = useCallback((payload: any) => {
        const incomingRideId = String(payload?.rideId ?? payload?.id ?? payload?._id)
        if (!incomingRideId || incomingRideId !== String(rideId)) return
        if (cancelledRef.current) return
        cancelledRef.current = true
        console.log('[LiveRide] received ride:no_rider', payload)
        try { bottomSheetRef.current?.snapToIndex?.(0) } catch (e) { }
        Alert.alert('No riders available', 'No riders accepted your request. Please try again.', [{ text: 'OK', onPress: () => router.replace('/customer/ridebooking') }])
    }, [rideId])

    const handleCancelled = useCallback((payload: any) => {
        const incomingRideId = String(payload?.rideId ?? payload?.id ?? payload?._id)
        if (!incomingRideId || incomingRideId !== String(rideId)) return
        if (cancelledRef.current) return
        cancelledRef.current = true
        console.log('[LiveRide] received ride:cancelled', payload)
        try { bottomSheetRef.current?.snapToIndex?.(0) } catch (e) { }
        Alert.alert('Ride cancelled', 'Your ride has been cancelled.', [{ text: 'OK', onPress: () => router.replace('/customer/home') }])
    }, [rideId])
    // useEffect(() => {
    //     if (id) {
    //         emit('subscribeRide', id)

    //         on('rideData', (data) => {
    //             setRideData(data)
    //         })
    //         // handle ride accepted (rider or customer accepted flow)
    //         const handleRideAccepted = (data: any) => {
    //             console.log('[LiveRide] ride:accepted received', data)
    //             const rideObj = data?.ride ?? data
    //             if (!rideObj) return
    //             setRideData(rideObj)
    //             Alert.alert('Ride Assigned', `Ride ${rideObj._id || rideObj.id} assigned. Status: ${rideObj.status}`)
    //         }
    //         on && on('ride:accepted', handleRideAccepted)
    //         on('rideCancelled', (error) => {
    //             console.log("Ride cancelled:", error)
    //             resetAndNavigate('/rider/home')
    //             Alert.alert("Ride Cancelled", error.message || "The ride has been cancelled by the rider.")
    //         })

    //         on('rideUpdate', (data) => {
    //             setRideData(data)
    //         })

    //         on('error', (error) => {
    //             console.log("Ride error:", error)
    //             resetAndNavigate('/rider/home')
    //             Alert.alert("Error", error.message || "An error occurred.")
    //         })

    //     }

    //     return () => {
    //         off('rideData')
    //         off && off('ride:accepted')
    //         off('error')
    //     }
    // }, [id, emit, on, off])
    // socket subscriptions for this ride
    useEffect(() => {
        if (!rideId) return
        console.log('[LiveRide] subscribing to ride events for', rideId, 'route params id=', id)
        // subscribe to ride room on server so server will send rideData updates to this socket
        try { emit && emit('subscribeRide', rideId); console.log('[LiveRide] emit subscribeRide', rideId) } catch (e) { console.warn('[LiveRide] emit subscribeRide failed', e) }
        // also listen for full rideData payloads
        const handleRideDataRaw = (data: any) => {
            try {
                console.log('[LiveRide] rideData event received (raw)', data)
                const r = data?.ride ?? data
                setRideData(r)
            } catch (e) { console.warn('[LiveRide] handleRideDataRaw failed', e) }
        }
        on && on('rideData', handleRideDataRaw)
        on && on('rideUpdate', handleRideUpdate)
        on && on('ride:no_rider', handleNoRider)
        on && on('ride:cancelled', handleCancelled)
        // unsub on cleanup
        return () => {
            off && off('rideData')
            off && off('rideUpdate',)
            off && off('ride:no_rider',)
            off && off('ride:cancelled',)
            cancelledRef.current = false
        }
    }, [rideId, on, off, handleRideUpdate, handleNoRider, handleCancelled])

    useEffect(() => {
        if (!rideData?.pickup || !location?.latitude) {
            setCanArrive(false)
            setPickupDistance(null)
            return
        }
        const pLat = Number(rideData.pickup.latitude ?? 0)
        const pLng = Number(rideData.pickup.longitude ?? 0)
        const dist = distanceMeters(location.latitude, location.longitude, pLat, pLng)
        setPickupDistance(dist)
        setCanArrive(dist <= ARRIVE_THRESHOLD_METERS)
    }, [rideData?.pickup, location?.latitude, location?.longitude])

    return (
        <View style={rideStyles.container}>
            <StatusBar style="light" backgroundColor='orange' translucent={false} />

            {/* {rideData && (
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
            )} */}
            {/* only render tracking when pickup & drop exist */}
            {rideData && rideData.pickup && rideData.drop ? (
                <RiderLiveTracking
                    status={rideData?.status}
                    drop={{
                        latitude: parseCoord(rideData?.drop?.latitude),
                        longitude: parseCoord(rideData?.drop?.longitude)
                    }}
                    pickup={{
                        latitude: parseCoord(rideData?.pickup?.latitude),
                        longitude: parseCoord(rideData?.pickup?.longitude)
                    }}
                    rider={{
                        latitude: parseCoord(location?.latitude),
                        longitude: parseCoord(location?.longitude),
                        heading: location?.heading
                    }}
                />
            ) : null}
            {/* <RiderActionButton
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
            /> */}
            {rideData ? (
                <RiderActionButton
                    ride={rideData}
                    title={
                        (rideData?.status === 'ARRIVING' || rideData?.status === 'START')
                            ? (canArrive ? 'ARRIVED' : 'ARRIVING')
                            : rideData?.status === 'ARRIVED'
                                ? 'COMPLETED'
                                : 'SUCCESS'
                    }
                    onPress={async () => {
                        if (!rideData) return
                        if (rideData.status === 'ARRIVING' || rideData.status === 'START') {
                            if (!canArrive) {
                                const meters = pickupDistance ? Math.round(pickupDistance) : null
                                Alert.alert('Not at pickup', meters ? `You are ${meters}m away. Move closer to mark ARRIVED.` : 'You are not at pickup yet.')
                                return
                            }
                            setIsOtpModalVisible(true)
                            return
                        }
                        const requestedStatus = 'COMPLETED'
                        console.log('[LiveRide] requesting updateRideStatus ->', rideData?.id || rideData?._id, requestedStatus, 'from RiderActionButton onPress')
                        const isSuccess = await updateRideStatus(rideData?.id || rideData?._id, requestedStatus)
                        console.log('[LiveRide] updateRideStatus returned:', isSuccess, 'requestedStatus=', requestedStatus)
                        if (isSuccess) {
                            try {
                                if (Platform.OS === 'android') {
                                    ToastAndroid.show('Ride Completed: The ride has been successfully completed.', ToastAndroid.SHORT)
                                } else {
                                    Alert.alert('Ride Completed', 'The ride has been successfully completed.')
                                }
                            } catch (e) { console.warn('[LiveRide] show completion toast failed', e) }
                            setRideData((prev: Record<string, any> | null) => prev ? { ...prev, status: requestedStatus } : prev)
                            resetAndNavigate('/rider/home')
                        } else {
                            try {
                                if (Platform.OS === 'android') {
                                    ToastAndroid.show('Error: Failed to complete the ride. Please try again.', ToastAndroid.SHORT)
                                } else {
                                    Alert.alert('Error', 'Failed to complete the ride. Please try again.')
                                }
                            } catch (e) { console.warn('[LiveRide] show error toast failed', e) }
                        }
                    }}
                    color="#228B22"
                />
            ) : null}

            {isOtpModalVisible && (
                <OtpInputModal
                    visible={isOtpModalVisible}
                    onClose={() => setIsOtpModalVisible(false)}
                    title="Enter OTP"
                    // onConfirm={async (otp) => {
                    //     if (otp === rideData?.otp) {
                    //         const isSuccess = await updateRideStatus(rideData?.id, 'ARRIVED')
                    //         if (isSuccess) {
                    //             setIsOtpModalVisible(false);
                    //             console.log("OTP entered:", otp);
                    //         } else {
                    //             Alert.alert("Error", "Failed to verify OTP. Please try again.");
                    //         }


                    //     } else {
                    //         Alert.alert("Error", "Invalid OTP. Please try again.");
                    //     }
                    // }}
                    onConfirm={async (otp) => {
                        try {
                            if (!rideData) {
                                Alert.alert('Error', 'No ride data available.')
                                return
                            }
                            if (String(otp) !== String(rideData?.otp)) {
                                Alert.alert('Error', 'Invalid OTP. Please try again.')
                                return
                            }
                            console.log('[LiveRide] OTP matched -> requesting ARRIVED update for', rideData?.id || rideData?._id)
                            const requestedStatus = 'ARRIVED'
                            console.log('[LiveRide] requesting updateRideStatus ->', rideData?.id || rideData?._id, requestedStatus, 'from OTP onConfirm')
                            const isSuccess = await updateRideStatus(rideData?.id || rideData?._id, requestedStatus)
                            console.log('[LiveRide] updateRideStatus returned:', isSuccess, 'requestedStatus=', requestedStatus)
                            if (isSuccess) {
                                setRideData((prev: Record<string, any> | null) => prev ? { ...prev, status: requestedStatus } : prev)
                                setIsOtpModalVisible(false)
                                try { emit && emit('ride:arrived', { rideId: rideData?.id || rideData?._id }) } catch (e) { console.warn('[LiveRide] emit ride:arrived failed', e) }
                                console.log('[LiveRide] ride status set to ARRIVED')
                            } else {
                                Alert.alert('Error', 'Failed to mark ARRIVED. Please try again.')
                            }
                        } catch (e) {
                            console.error('[LiveRide] OTP confirm error', e)
                            Alert.alert('Error', 'Failed to verify OTP. Please try again.')
                        }
                    }}
                />
            )}
        </View>
    )
}

export default LiveRide