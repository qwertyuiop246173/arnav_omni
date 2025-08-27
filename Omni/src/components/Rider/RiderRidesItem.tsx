import { View, Text, Image, TouchableOpacity, Platform, Alert, ToastAndroid } from 'react-native'
import React, { FC, memo, useEffect } from 'react'
import { acceptRideOffer } from '@/service/rideService'
import { useRiderStore } from '@/store/riderStore'
import Animated, { FadeInLeft, FadeOutRight } from 'react-native-reanimated'
import { orderStyles } from '@/styles/riderStyles'
import { commonStyles } from '@/styles/commonStyles'
import { calculateDistance, vehicleIcons } from '@/utils/mapUtils'
import CustomText from '../shared/customText'
import { Ionicons } from '@expo/vector-icons'
import CounterButton from './CounterButton'
import { UseWS } from '@/service/WSProvider'
import { router } from 'expo-router'
import { useUserStore } from '@/store/userStore'
import { apiClient } from '@/service/apiIntereptors'
import { tokenStorage } from '@/store/storage'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as  jwt_decode from 'jwt-decode'

type VehicleType = 'bike' | 'auto' | 'cabEconomy' | 'cabPremium'

interface RideItem {
    _id: string
    vehicle?: VehicleType
    pickup?: { address: string, latitude: number, longitude: number }
    drop?: { address: string, latitude: number, longitude: number }
    fare?: number
    distance: number
    raw?: any
    price?: number
    customerSocketId?: string
    riderId?: string
}
const RiderRidesItem: FC<{ item: RideItem; removeIt: () => void }> = ({ item, removeIt }) => {
    const { location } = useRiderStore()
    const { emit, on, off, socket } = UseWS() as any
    const userStore = useUserStore?.() as any
    const currentUserId = userStore?.user?._id || null
    // const acceptRide = async () => {
    //     acceptRideOffer(item?._id)
    // }

    useEffect(() => {
        const rideId = String(item?._id)
        if (!rideId) return
        // named handlers so we can reliably remove them
        const handleCancelled = (payload: any) => {
            try {
                console.log('[RiderRidesItem] cancel-like payload received', { rideId, payload })
                const incoming = String(
                    payload?.rideId ??
                    payload?._id ??
                    payload?.id ??
                    payload?.ride?._id ??
                    ''
                )
                if (!incoming || incoming !== rideId) return

                // If payload contains offeredTo and current user removed -> immediately remove UI
                const offeredArr = payload?.offeredTo ?? payload?.ride?.offeredTo ?? null
                if (Array.isArray(offeredArr) && currentUserId && !offeredArr.map(String).includes(String(currentUserId))) {
                    console.log('[RiderRidesItem] current user removed from offeredTo -> removing offer', rideId)
                    removeIt && removeIt()
                    return
                }
                // fallback: if payload indicates cancellation/expiry directly
                const status = String(payload?.status ?? payload?.ride?.status ?? '').toUpperCase()
                if (['CANCELLED', 'NO_RIDER_ALLOTTED', 'EXPIRED', 'COMPLETED'].includes(status)) {
                    removeIt && removeIt()
                    return
                }

                // notify rider and remove
                const msg = 'Ride offer cancelled'
                if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT)
                else Alert.alert(msg)
                removeIt && removeIt()
            } catch (e) {
                console.warn('[RiderRidesItem] handleCancelled error', e)
            }
        }

        const handleRideUpdate = (data: any) => {
            try {
                console.log('[RiderRidesItem] rideUpdate payload', { rideId, data })
                const r = data?.ride ?? data
                const incoming = String(r?._id ?? r?.rideId ?? r?.id ?? '')
                if (!incoming || incoming !== rideId) return

                // If offeredTo array exists and current rider removed -> remove UI immediately
                if (Array.isArray(r?.offeredTo) && currentUserId && !r.offeredTo.map(String).includes(String(currentUserId))) {
                    console.log('[RiderRidesItem] offeredTo no longer contains currentUser -> removing', rideId)
                    removeIt && removeIt()
                    return
                }
                const status = String(r?.status ?? '').toUpperCase()
                if (['CANCELLED', 'NO_RIDER_ALLOTTED', 'COMPLETED', 'EXPIRED'].includes(status)) {
                    removeIt && removeIt()
                }
            } catch (e) {
                console.warn('[RiderRidesItem] handleRideUpdate error', e)
            }
        }
        // Register via wrapper if available
        try {
            on && on('ride:cancelled', handleCancelled)
            on && on('ride:no_rider', handleCancelled)
            on && on('rideUpdate', handleRideUpdate)
            on && on('ride:offer_expired', handleCancelled)
            on && on('offer:cancelled', handleCancelled)
            on && on('offer:removed', handleCancelled)
            on && on('offerExpired', handleCancelled)
        } catch (e) {
            console.warn('[RiderRidesItem] UseWS.on registration failed', e)
        }
        // Redundant direct socket registration (in case wrapper doesn't forward)
        try {
            socket && socket.on && socket.on('ride:cancelled', handleCancelled)
            socket && socket.on && socket.on('ride:no_rider', handleCancelled)
            socket && socket.on && socket.on('rideUpdate', handleRideUpdate)
            socket && socket.on && socket.on('ride:offer_expired', handleCancelled)
            socket && socket.on && socket.on('offer:cancelled', handleCancelled)
        } catch (e) {
            console.warn('[RiderRidesItem] direct socket.on registration failed', e)
        }

        // Fallback polling: if no cancel event arrives, poll ride status a few times and remove if changed.
        let pollAttempts = 0
        let pollTimer: ReturnType<typeof setInterval> | null = null
        const startPollingFallback = () => {
            if (pollTimer) return
            pollTimer = setInterval(async () => {
                pollAttempts++
                try {
                    const res = await apiClient.get(`/ride/${rideId}`)
                    const r = res?.data?.ride ?? res?.data ?? res
                    const status = String(r?.status ?? '').toUpperCase()
                    if (['CANCELLED', 'NO_RIDER_ALLOTTED', 'EXPIRED', 'COMPLETED'].includes(status)) {
                        console.log('[RiderRidesItem] fallback poll detected cancellation/status change -> removing', rideId, status)
                        removeIt && removeIt()
                        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
                        return
                    }
                    // if offeredTo array exists and current user removed -> remove
                    if (Array.isArray(r?.offeredTo) && currentUserId && !r.offeredTo.map(String).includes(String(currentUserId))) {
                        console.log('[RiderRidesItem] fallback poll detected offeredTo removal -> removing', rideId)
                        removeIt && removeIt()
                        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
                        return
                    }
                } catch (e) {
                    console.warn('[RiderRidesItem] fallback poll error', e)
                }
                if (pollAttempts >= 4 && pollTimer) { clearInterval(pollTimer); pollTimer = null }
            }, 2000)
        }
        // start fallback polling in case server misses event
        startPollingFallback()

        return () => {
            try {
                off && off('ride:cancelled', handleCancelled)
                off && off('ride:no_rider', handleCancelled)
                off && off('rideUpdate', handleRideUpdate)
                off && off('ride:offer_expired', handleCancelled)
                off && off('offer:cancelled', handleCancelled)
                off && off('offer:removed', handleCancelled)
                off && off('offerExpired', handleCancelled)
            } catch (e) {
                console.warn('[RiderRidesItem] cleanup UseWS.off error', e)
            }
            try {
                socket && socket.off && socket.off('ride:cancelled', handleCancelled)
                socket && socket.off && socket.off('ride:no_rider', handleCancelled)
                socket && socket.off && socket.off('rideUpdate', handleRideUpdate)
                socket && socket.off && socket.off('ride:offer_expired', handleCancelled)
                socket && socket.off && socket.off('offer:cancelled', handleCancelled)
            } catch (e) {
                console.warn('[RiderRidesItem] cleanup socket.off error', e)
            }
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
        }
    }, [item?._id, on, off, socket, removeIt, currentUserId])


    // const onAccept = async () => {
    //     try {
    //         console.log('[RiderRidesItem] Accept pressed for ride', item?._id)

    //         const rideId = item?._id
    //         let riderId = currentUserId || item?.riderId || item?.raw?.rider?._id || null
    //         const customerSocketId = item?.customerSocketId || item?.raw?.customerSocketId || null
    //         const price = Number(item?.fare ?? item?.price ?? 0)

    //         // try decode token from local storage (fast, no network) using jwt-decode
    //         if (!riderId) {
    //             try {
    //                 const tok =
    //                     (tokenStorage as any)?.getString?.('access_token') ||
    //                     (tokenStorage as any)?.getString?.('accessToken') ||
    //                     (tokenStorage as any)?.getString?.('token') ||
    //                     (await AsyncStorage.getItem('accessToken')) ||
    //                     (await AsyncStorage.getItem('token')) ||
    //                     null

    //                 if (tok) {
    //                     try {
    //                         const payload: any = (jwt_decode as any)(String(tok))
    //                         riderId = payload?.id || payload?._id || payload?.userId || riderId || null
    //                         console.log('[RiderRidesItem] decoded riderId from token via jwt-decode', riderId)
    //                     } catch (e) {
    //                         console.warn('[RiderRidesItem] jwt-decode failed', e)
    //                     }
    //                 }
    //             } catch (e) {
    //                 console.warn('[RiderRidesItem] token read/decode failed', e)
    //             }
    //         }

    //         // fallback: also check socket.user (socket auth middleware may have injected user)
    //         if (!riderId) {
    //             try {
    //                 const sockUserId = (socket as any)?.user?.id || (socket as any)?.user?._id
    //                 if (sockUserId) {
    //                     riderId = sockUserId
    //                     console.log('[RiderRidesItem] got riderId from socket.user', riderId)
    //                 }
    //             } catch (e) { /* ignore */ }
    //         }

    //         // fallback: try /auth/me if still missing
    //         if (!riderId) {
    //             try {
    //                 console.log('[RiderRidesItem] riderId missing, calling /auth/me as fallback')
    //                 const res = await apiClient.get('/auth/me')
    //                 riderId = res?.data?._id || res?.data?.id || res?.data?.userId || null
    //                 console.log('[RiderRidesItem] fetched current user id via /auth/me', riderId)
    //             } catch (e) {
    //                 console.warn('[RiderRidesItem] failed to fetch current user via /auth/me', e)
    //             }
    //         }

    //         if (!rideId || !riderId) {
    //             console.warn('[RiderRidesItem] cannot accept offer: missing rideId or riderId', { rideId, riderId })
    //             return
    //         }

    //         const offerPayload = { rideId, riderId, price, customerSocketId, riderSocketId: socket?.id || null }
    //         console.log('[RiderRidesItem] emitting offer:accept', offerPayload)
    //         emit && emit('offer:accept', offerPayload)

    //         try {
    //             const rid = item?._id
    //             if (rid) {
    //                 console.log('[RiderRidesItem] navigating to rider live ride for', rid)
    //                 router.replace(`/rider/liveride?id=${rid}`)
    //             }
    //         } catch (navErr) {
    //             console.warn('[RiderRidesItem] navigation failed', navErr)
    //         }

    //         removeIt && removeIt()
    //     } catch (e) {
    //         console.error('[RiderRidesItem] accept error', e)
    //     }
    // }

    const onAccept = async () => {
        try {
            const rideId = item?._id
            if (!rideId) return
            // fetch latest ride state from server to validate offer still valid
            let ride: any = null
            try {
                const res = await apiClient.get(`/ride/${rideId}`)
                ride = res?.data?.ride ?? res?.data ?? res
            } catch (e) {
                console.warn('[RiderRidesItem] failed to fetch ride before accept', e)
            }

            const status = String(ride?.status ?? '').toUpperCase()
            if (['CANCELLED', 'COMPLETED', 'NO_RIDER_ALLOTTED'].includes(status)) {
                const msg = 'Ride offer cancelled'
                if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT)
                else Alert.alert(msg)
                return
            }
            const offered = Array.isArray(ride?.offeredTo) ? ride.offeredTo.map(String) : []
            if (offered.length && !offered.includes(String(currentUserId))) {
                const msg = 'Offer cancelled for you'
                if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT)
                else Alert.alert(msg)
                return
            }

            // proceed with existing accept flow (emit + navigate)
            console.log('[RiderRidesItem] Accept pressed for ride', rideId)

            let riderId = currentUserId || item?.riderId || item?.raw?.rider?._id || null
            const customerSocketId = item?.customerSocketId || item?.raw?.customerSocketId || null
            const price = Number(item?.fare ?? item?.price ?? 0)
            // try decode token from local storage (fast, no network) using jwt-decode
            if (!riderId) {
                try {
                    const tok =
                        (tokenStorage as any)?.getString?.('access_token') ||
                        (tokenStorage as any)?.getString?.('accessToken') ||
                        (tokenStorage as any)?.getString?.('token') ||
                        (await AsyncStorage.getItem('accessToken')) ||
                        (await AsyncStorage.getItem('token')) ||
                        null

                    if (tok) {
                        try {
                            const payload: any = (jwt_decode as any)(String(tok))
                            riderId = payload?.id || payload?._id || payload?.userId || riderId || null
                            console.log('[RiderRidesItem] decoded riderId from token via jwt-decode', riderId)
                        } catch (e) {
                            console.warn('[RiderRidesItem] jwt-decode failed', e)
                        }
                    }
                } catch (e) {
                    console.warn('[RiderRidesItem] token read/decode failed', e)
                }
            }
            // fallback: also check socket.user (socket auth middleware may have injected user)
            if (!riderId) {
                try {
                    const sockUserId = (socket as any)?.user?.id || (socket as any)?.user?._id
                    if (sockUserId) {
                        riderId = sockUserId
                        console.log('[RiderRidesItem] got riderId from socket.user', riderId)
                    }
                } catch (e) { /* ignore */ }
            }
            // fallback: try /auth/me if still missing
            if (!riderId) {
                try {
                    console.log('[RiderRidesItem] riderId missing, calling /auth/me as fallback')
                    const res = await apiClient.get('/auth/me')
                    riderId = res?.data?._id || res?.data?.id || res?.data?.userId || null
                    console.log('[RiderRidesItem] fetched current user id via /auth/me', riderId)
                } catch (e) {
                    console.warn('[RiderRidesItem] failed to fetch current user via /auth/me', e)
                }
            }

            if (!rideId || !riderId) {
                console.warn('[RiderRidesItem] cannot accept offer: missing rideId or riderId', { rideId, riderId })
                return
            }

            const offerPayload = { rideId, riderId, price, customerSocketId, riderSocketId: socket?.id || null }
            console.log('[RiderRidesItem] emitting offer:accept', offerPayload)
            emit && emit('offer:accept', offerPayload)
            try {
                const rid = item?._id
                if (rid) {
                    console.log('[RiderRidesItem] navigating to rider live ride for', rid)
                    router.replace(`/rider/liveride?id=${rid}`)
                }
            } catch (navErr) {
                console.warn('[RiderRidesItem] navigation failed', navErr)
            }
            removeIt && removeIt()
        } catch (e) {
            console.error('[RiderRidesItem] accept error', e)
        }
    }
    return (
        <Animated.View
            entering={FadeInLeft.duration(500)}
            exiting={FadeOutRight.duration(500)}
            style={orderStyles.container}>
            <View style={commonStyles.flexRowBetween}>
                <View style={commonStyles.flexRow}>
                    {item?.vehicle && (
                        <Image source={vehicleIcons![item.vehicle]?.icon}
                            style={orderStyles.rideIcon} />
                    )}
                    <CustomText style={{ textTransform: 'capitalize' }} fontSize={11}>{item.vehicle}</CustomText>
                </View>
                <CustomText fontSize={11} fontFamily='SemiBold'>#RID {item?._id?.slice(0, 5).toUpperCase()}</CustomText>
            </View>
            <View style={orderStyles?.locationsContainer}>
                <View style={orderStyles?.flexRowBase}>
                    <View>
                        <View style={orderStyles?.pickupHollowCircle} />
                        <View style={orderStyles?.continuousLine} />
                    </View>
                    <View style={orderStyles?.infoText}>
                        <CustomText fontSize={11} numberOfLines={1} fontFamily='SemiBold'>{item?.pickup?.address?.slice(0, 10)}</CustomText>
                        <CustomText fontSize={9.5} numberOfLines={2} fontFamily='Medium'>{item?.pickup?.address}</CustomText>
                    </View>
                </View>
                <View>
                    <View style={orderStyles?.flexRowBase}>
                        <View style={orderStyles?.dropHollowCircle} />
                        <View style={orderStyles?.infoText}>
                            <CustomText fontSize={11} numberOfLines={1} fontFamily='SemiBold'>{item?.drop?.address?.slice(0, 10)}</CustomText>
                            <CustomText
                                fontSize={9.5}
                                numberOfLines={2}
                                fontFamily='Medium'
                                style={orderStyles.label}>{item?.drop?.address}
                            </CustomText>
                        </View>
                    </View>
                </View>
            </View>
            <View style={[commonStyles?.flexRowGap]}>
                <View>
                    <CustomText
                        fontFamily='Medium'
                        fontSize={9}
                        style={orderStyles.label}>Pickup</CustomText>
                    <CustomText fontFamily='SemiBold' fontSize={11}>
                        {(location &&
                            calculateDistance(
                                item?.pickup?.latitude ?? 0,
                                item?.pickup?.longitude ?? 0,
                                location?.latitude ?? 0,
                                location?.longitude ?? 0,
                            ).toFixed(2)) ||
                            "--"}{""}Km
                    </CustomText>
                </View>
                <View style={orderStyles.borderLine}>
                    <CustomText
                        fontSize={9}
                        fontFamily='Medium'
                        style={orderStyles.label}>Drop</CustomText>
                    <CustomText
                        fontSize={11}
                        fontFamily='SemiBold'>
                        {item?.distance.toFixed(2)} Km
                    </CustomText>
                </View>
            </View>
            <View style={orderStyles?.flexRowEnd}>
                <TouchableOpacity>
                    <Ionicons name="close-circle" size={24} color="black" />
                </TouchableOpacity>
                <CounterButton
                    title='Accept'
                    onCountdownEnd={removeIt}
                    initialCount={12}
                    onPress={onAccept} />
            </View>
        </Animated.View>
    )
}

export default memo(RiderRidesItem)