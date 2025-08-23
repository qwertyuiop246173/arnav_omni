import { View, Platform, ActivityIndicator, Alert } from 'react-native'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { screenHeight } from '@/utils/Constants'
import { UseWS } from '@/service/WSProvider'
import { useRoute } from '@react-navigation/native'
import { rideStyles } from '@/styles/rideStyles'
import { StatusBar } from 'expo-status-bar'
import LiveTrackingMap from '@/components/customer/LiveTrackingMap'
import CustomText from '@/components/shared/customText'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import SearchingRideSheet from '@/components/customer/SearchingRIdeSheet'
import LiveTrackingSheet from '@/components/customer/LiveTrackingSheet'
import { resetAndNavigate } from '@/utils/Helpers'


const androidHeights = [screenHeight * 0.12, screenHeight * 0.42]
const iosHeights = [screenHeight * 0.2, screenHeight * 0.5]
const LiveRide = () => {
    const { emit, on, off, socket } = UseWS()
    const [rideData, setRideData] = useState<any>(null)
    const [riderCoords, setRiderCoords] = useState<any>(null)
    const route = useRoute() as any
    const params = route?.params || {}
    const id = params.id
    const bottomSheetRef = useRef(null)
    const snapPoints = useMemo(() => Platform.OS === 'ios' ? iosHeights : androidHeights, [])
    const [mapHeight, setMapHeight] = useState(snapPoints[0])
    const handleSheetChanges = useCallback((index: number) => {
        let height = screenHeight * 0.8
        if (index == 1) {
            height = screenHeight * 0.5
        }
        setMapHeight(height)
    }, [])


    // useEffect(() => {

    //     if (id) {
    //         emit('subscribeRide', id)
    //         on('rideData', (data) => {
    //             setRideData(data)
    //             if (data?.status === 'SEARCHING_FOR_RIDER') {
    //                 emit('searchRide', id)
    //             }
    //         })
    //         on('rideUpdate', (data) => {
    //             setRideData(data)
    //         })
    //         on('rideCancelled', (error) => {
    //             resetAndNavigate('/customer/home')
    //             Alert.alert("Ride Cancelled", error?.message)
    //         })
    //         on('error', (error) => {
    //             resetAndNavigate('/customer/home')
    //             Alert.alert("Error", error?.message)
    //         })
    //     }
    //     return () => {
    //         off('rideData')
    //         off('rideUpdate')
    //         off('rideCancelled')
    //         off('error')
    //     }
    // }, [id, emit, on, off])
    // useEffect(() => {
    //     if (rideData?.rider?._id) {
    //         emit('subscribeToriderLocation', rideData?.rider?._id)
    //         on('riderLocationUpdate', (data) => {
    //             setRiderCoords(data?.coords)
    //         })
    //     }
    //     return () => {
    //         off('riderLocationUpdate')
    //     }
    // }, [rideData])
    useEffect(() => {
        if (!params?.ride) return
        try {
            console.log('[LiveRide] hydrating rideData from route param')
            const parsed = typeof params.ride === 'string' ? JSON.parse(params.ride) : params.ride
            if (parsed) {
                setRideData(parsed)
                console.log('[LiveRide] rideData set from param', parsed?._id || parsed?.id)
            }
        } catch (e) {
            console.warn('[LiveRide] failed to parse ride param', e)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params?.ride])
    useEffect(() => {
        let mounted = true
        console.log('[LiveRide] subscribe effect start, id=', id)
        if (!id) {
            console.warn('[LiveRide] no ride id in route params')
            return
        }

        try {
            emit && emit('subscribeRide', id)
            console.log('[LiveRide] emitted subscribeRide', id)
        } catch (e) {
            console.warn('[LiveRide] emit subscribeRide failed', e)
        }

        const handleRideData = (data: any) => {
            console.log('[LiveRide] socket rideData received', data)
            if (!mounted) return
            const rideObj = data?.ride ?? data
            setRideData(rideObj)
            if (rideObj?.status === 'SEARCHING_FOR_RIDER') {
                try {
                    console.log('[LiveRide] status SEARCHING_FOR_RIDER -> emit searchRide', id)
                    emit && emit('searchRide', id)
                } catch (e) {
                    console.warn('[LiveRide] emit searchRide failed', e)
                }
            }
        }

        const handleRideUpdate = (data: any) => {
            console.log('[LiveRide] socket rideUpdate received', data)
            if (!mounted) return
            const rideObj = data?.ride ?? data
            setRideData(rideObj)
        }

        const handleRideCancelled = (error: any) => {
            console.log('[LiveRide] socket rideCancelled', error)
            if (!mounted) return
            resetAndNavigate('/customer/home')
            Alert.alert('Ride Cancelled', error?.message || 'Ride cancelled')
        }

        const handleError = (error: any) => {
            console.log('[LiveRide] socket error', error)
            if (!mounted) return
            resetAndNavigate('/customer/home')
            Alert.alert('Error', error?.message || 'An error occurred')
        }

        on && on('rideData', handleRideData)
        on && on('rideUpdate', handleRideUpdate)
        on && on('rideCancelled', handleRideCancelled)
        on && on('error', handleError)
        console.log('[LiveRide] socket handlers registered')

        return () => {
            mounted = false
            try {
                off && off('rideData')
                off && off('rideUpdate')
                off && off('rideCancelled')
                off && off('error')
                console.log('[LiveRide] unsubscribed socket handlers')
            } catch (e) {
                console.warn('[LiveRide] cleanup error', e)
            }
        }
    }, [id, emit, on, off])

    // subscribe to rider location updates when rider assigned
    useEffect(() => {
        let mounted = true
        if (!rideData?.rider?._id) return

        const riderId = rideData.rider._id
        console.log('[LiveRide] subscribing to rider location for riderId=', riderId)
        try {
            emit && emit('subscribeToriderLocation', riderId)
        } catch (e) {
            console.warn('[LiveRide] emit subscribeToriderLocation failed', e)
        }

        const handleRiderLocation = (data: any) => {
            if (!mounted) return
            console.log('[LiveRide] riderLocationUpdate', data)
            setRiderCoords(data?.coords ?? data)
        }

        on && on('riderLocationUpdate', handleRiderLocation)

        return () => {
            mounted = false
            try {
                off && off('riderLocationUpdate')
                console.log('[LiveRide] unsubscribed riderLocationUpdate')
            } catch (e) {
                console.warn('[LiveRide] cleanup riderLocationUpdate error', e)
            }
        }
    }, [rideData, emit, on, off])


    return (

        <View style={rideStyles.container}>
            <StatusBar
                style='light'
                backgroundColor='orange'
                translucent={false} />

            {rideData && (
                <LiveTrackingMap
                    height={mapHeight}
                    status={rideData?.status}
                    drop={{
                        latitude: parseFloat(rideData?.drop?.latitude),
                        longitude: parseFloat(rideData?.pickup?.longitude)
                    }}
                    pickup={{
                        latitude: parseFloat(rideData?.pickup?.latitude),
                        longitude: parseFloat(rideData?.pickup?.longitude)
                    }}
                    rider={riderCoords ? {
                        latitude: riderCoords.latitude,
                        longitude: riderCoords.longitude,
                        heading: riderCoords.heading
                    } : {}} />
            )}
            {rideData ? (
                <BottomSheet
                    ref={bottomSheetRef}
                    index={1}
                    handleIndicatorStyle={{ backgroundColor: '#ccc' }}
                    enableOverDrag={false}
                    enableDynamicSizing={false}
                    style={{ zIndex: 4 }}
                    snapPoints={snapPoints}
                    onChange={handleSheetChanges}>
                    <BottomSheetScrollView contentContainerStyle={rideStyles?.container}>
                        {rideData?.status === 'SEARCHING_FOR_RIDER' ? (
                            <SearchingRideSheet item={rideData} />
                        ) : (
                            <LiveTrackingSheet item={rideData} />
                        )}
                    </BottomSheetScrollView>
                </BottomSheet>) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <CustomText variant='h8'> Fetching Information ... </CustomText>
                    <ActivityIndicator color='black' size='small' />
                </View>)
            }
        </View>
    )
}

export default memo(LiveRide)