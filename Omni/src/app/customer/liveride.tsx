import { View, Platform, ActivityIndicator, Alert, Text, TouchableOpacity, ToastAndroid } from 'react-native'
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
    // const bottomSheetRef = useRef(null)
    const bottomSheetRef = useRef<any>(null)
    const [offers, setOffers] = useState<any[]>([])
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
    // hydrate from navigation param (fast UI)
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

    // subscribe to ride via socket and register handlers
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

    // handle incoming offers (from riders via server)
    useEffect(() => {
        if (!id) return
        console.log('[LiveRide] registering offer listeners for ride', id)
        const handleRideOffer = (offer: any) => {
            try {
                console.log('[LiveRide] << OFFER_HANDLER start >>', { offer })
                console.log('[LiveRide] ride:offer received', offer)
                console.log('[LiveRide] normalizing offer...')
                const normalized = {
                    _id: offer?.rideId || offer?.ride?._id || Math.random().toString(),
                    riderId: offer?.riderId || offer?.fromSocket || offer?.rider?._id || offer?.from,
                    price: Number(offer?.price ?? offer?.fare ?? 0),
                    riderInfo: offer?.rider ?? offer?.from ?? null,
                    raw: offer
                }
                console.log('[LiveRide] normalized offer', normalized)
                setOffers(prev => {
                    if (prev.some(p => p._id === normalized._id && p.riderId === normalized.riderId)) {
                        console.log('[LiveRide] duplicate offer ignored', normalized._id)
                        console.log('[LiveRide] duplicate offer ignored', normalized._id)
                        return prev
                    }

                    console.log('[LiveRide] appending offer', normalized)
                    return [normalized, ...prev]
                })
                // quick notification
                Alert.alert('New Offer', `Offer ₹${normalized.price}`)
                console.log('[LiveRide] << OFFER_HANDLER end >>', { offerId: normalized._id })
            } catch (e) {
                console.warn('[LiveRide] handleRideOffer error', e)
            }
        }
        // const handleRideOffer = (offer: any) => {
        //     try {
        //         console.log('[LiveRide] ride:offer received', offer)
        //         const normalized = {
        //             _id: offer?.rideId || offer?.ride?._id || Math.random().toString(),
        //             riderId: offer?.riderId || offer?.fromSocket || offer?.rider?._id || offer?.from,
        //             price: Number(offer?.price ?? offer?.fare ?? 0),
        //             riderInfo: offer?.rider ?? offer?.from ?? null,
        //             raw: offer
        //         }
        //         setOffers(prev => {
        //             if (prev.some(p => p._id === normalized._id && p.riderId === normalized.riderId)) {
        //                 console.log('[LiveRide] duplicate offer ignored', normalized._id)
        //                 return prev
        //             }
        //             console.log('[LiveRide] appending offer', normalized)
        //             return [normalized, ...prev]
        //         })
        //         // quick notification
        //         Alert.alert('New Offer', `Offer ₹${normalized.price}`)
        //     } catch (e) {
        //         console.warn('[LiveRide] handleRideOffer error', e)
        //     }
        // }
        const handleRideAccepted = (payload: any) => {
            try {

                console.log('[LiveRide] << RIDE_ACCEPTED Handler start >>', { payload })
                const rideObj = payload?.ride ?? payload
                if (!rideObj) return
                console.log('[LiveRide] setting rideData for accepted ride', rideObj._id)
                setRideData(rideObj)
                // clear any pending offers for this ride
                setOffers([])
                // open bottom sheet so UI transitions to LiveTrackingSheet
                try {
                    console.log('[LiveRide] attempting to open bottom sheet after accept')
                    bottomSheetRef.current?.snapToIndex?.(1)
                    console.log('[LiveRide] bottom sheet opened after ride:accepted')
                    console.log('[LiveRide] << RIDE_ACCEPTED Handler end >>', { rideId: rideObj._id })
                } catch (e) {
                    console.warn('[LiveRide] open bottom sheet failed', e)
                }
            } catch (e) {
                console.warn('[LiveRide] handleRideAccepted error', e)
            }
        }
        // const handleRideAccepted = (payload: any) => {
        //     try {
        //         console.log('[LiveRide] ride:accepted received', payload)
        //         const rideObj = payload?.ride ?? payload
        //         if (!rideObj) return
        //         setRideData(rideObj)
        //         // clear any pending offers for this ride
        //         setOffers([])
        //         // open bottom sheet so UI transitions to LiveTrackingSheet
        //         try {
        //             bottomSheetRef.current?.snapToIndex?.(1)
        //             console.log('[LiveRide] bottom sheet opened after ride:accepted')
        //         } catch (e) {
        //             console.warn('[LiveRide] open bottom sheet failed', e)
        //         }
        //     } catch (e) {
        //         console.warn('[LiveRide] handleRideAccepted error', e)
        //     }
        // }

        on && on('ride:offer', handleRideOffer)
        on && on('ride:accepted', handleRideAccepted)
        on && on('ride:offer:legacy', handleRideOffer)

        return () => {
            try {
                off && off('ride:offer')
                off && off('ride:accepted')
                off && off('ride:offer:legacy')
                console.log('[LiveRide] removed offer listeners')
            } catch (e) {
                console.warn('[LiveRide] cleanup offer listeners error', e)
            }
        }
    }, [id, on, off, emit])

    // accept an offer (customer)
    // const acceptOffer = (offer: any) => {
    //     try {
    //         console.log('[LiveRide] customer accepting offer', offer)
    //         if (!id) {
    //             console.warn('[LiveRide] cannot accept offer, missing ride id')
    //             return
    //         }
    //         emit && emit('customer:accept_offer', { rideId: id, riderId: offer.riderId })
    //         // remove accepted offer from UI
    //         setOffers(prev => prev.filter(o => o._id !== offer._id || o.riderId !== offer.riderId))
    //         console.log('[LiveRide] emitted customer:accept_offer', { rideId: id, riderId: offer.riderId })
    //     } catch (e) {
    //         console.error('[LiveRide] acceptOffer error', e)
    //         Alert.alert('Error', 'Failed to accept offer. Try again.')
    //     }
    // }

    const acceptOffer = (offer: any) => {
        try {
            // -            console.log('[LiveRide] customer accepting offer', offer)
            console.log('[LiveRide] CUSTOMER acceptOffer clicked', { offer })
            if (!id) {
                console.warn('[LiveRide] cannot accept offer, missing ride id')
                return
            }
            // -            emit && emit('customer:accept_offer', { rideId: id, riderId: offer.riderId })
            console.log('[LiveRide] emitting customer:accept_offer -> server', { rideId: id, riderId: offer.riderId })
            emit && emit('customer:accept_offer', { rideId: id, riderId: offer.riderId })
            // remove accepted offer from UI
            setOffers(prev => prev.filter(o => o._id !== offer._id || o.riderId !== offer.riderId))
            // -            console.log('[LiveRide] emitted customer:accept_offer', { rideId: id, riderId: offer.riderId })
            console.log('[LiveRide] removed accepted offer from UI', { offerId: offer._id })
            console.log('[LiveRide] customer:accept_offer emitted (done)')
        } catch (e) {
            console.error('[LiveRide] acceptOffer error', e)
            Alert.alert('Error', 'Failed to accept offer. Try again.')
        }
    }

    // open bottom sheet when rideData arrives
    // useEffect(() => {
    //     if (!rideData) return
    //     console.log('[LiveRide] rideData available -> opening bottom sheet if possible', rideData?.status)
    //     const t = setTimeout(() => {
    //         try {
    //             bottomSheetRef.current?.snapToIndex?.(1)
    //             console.log('[LiveRide] bottomSheet snapToIndex(1) called')
    //         } catch (e) {
    //             try {
    //                 bottomSheetRef.current?.expand?.()
    //                 console.log('[LiveRide] bottomSheet expand called')
    //             } catch (e2) {
    //                 console.warn('[LiveRide] bottomSheet open failed', e2)
    //             }
    //         }
    //     }, 50)
    //     return () => clearTimeout(t)
    // }, [rideData])

    useEffect(() => {
        if (!rideData) return
        try {
            const status = String(rideData.status || '').toUpperCase()
            if (status === 'NO_RIDER_ALLOTED' || status === 'NO RIDER ALLOTED') {
                console.log('[LiveRide] received No_RIDER_ALLOTED -> navigate home')
                // user feedback
                try {
                    if (Platform.OS === 'android') ToastAndroid.show('No rider available — try again', ToastAndroid.SHORT)
                    else Alert.alert('No Rider', 'No rider available — try again')
                } catch (e) { /* ignore */ }

                // best-effort remove listeners
                try {
                    off && off('rideData')
                    off && off('rideUpdate')
                    off && off('rideCancelled')
                    off && off('error')
                    off && off('riderLocationUpdate')
                    off && off('ride:offer')
                    off && off('ride:accepted')
                } catch (e) { console.warn('[LiveRide] cleanup error before navigate', e) }

                // clear local state and navigate home (replace so back stack is clean)
                setRideData(null)
                resetAndNavigate('/customer/home')
                return
            }
        } catch (e) {
            console.warn('[LiveRide] No_RIDER_ALLOTED handler error', e)
        }
    }, [rideData, off])

    // handle ride cancelled explicitly: cleanup sockets and navigate home
    useEffect(() => {
        if (!rideData) return
        try {
            if (String(rideData.status ?? '').toUpperCase() === 'CANCELLED') {
                console.log('[LiveRide] ride cancelled -> cleaning up and navigating home', rideData._id)
                // show brief message
                if (Platform.OS === 'android') ToastAndroid.show('Ride cancelled', ToastAndroid.SHORT)
                else Alert.alert('Ride cancelled')

                // remove relevant global socket listeners (best-effort)
                try {
                    off && off('rideData')
                    off && off('rideUpdate')
                    off && off('rideCancelled')
                    off && off('error')
                    off && off('riderLocationUpdate')
                    off && off('ride:offer')
                    off && off('ride:accepted')
                    off && off('ride:offer:legacy')
                    console.log('[LiveRide] removed global socket listeners before navigation')
                } catch (e) {
                    console.warn('[LiveRide] off cleanup error', e)
                }

                // navigate back (replace so back-stack is clean)
                resetAndNavigate('/customer/home')
            }
        } catch (e) {
            console.warn('[LiveRide] cancelled handler error', e)
        }
    }, [rideData, off])

    // parse coordinates safely with fallback
    const parseCoord = (v: any) => {
        if (v === null || v === undefined) return 0
        const n = typeof v === 'number' ? v : parseFloat(String(v))
        return Number.isFinite(n) ? n : 0
    }

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
                        // latitude: parseFloat(rideData?.drop?.latitude),
                        // longitude: parseFloat(rideData?.drop?.longitude)
                        latitude: parseCoord(rideData?.drop?.latitude),
                        longitude: parseCoord(rideData?.drop?.longitude)
                    }}
                    pickup={{
                        // latitude: parseFloat(rideData?.pickup?.latitude),
                        // longitude: parseFloat(rideData?.pickup?.longitude)
                        latitude: parseCoord(rideData?.pickup?.latitude),
                        longitude: parseCoord(rideData?.pickup?.longitude)
                    }}
                    rider={riderCoords ? {
                        // latitude: riderCoords.latitude,
                        // longitude: riderCoords.longitude,
                        latitude: parseCoord(riderCoords.latitude),
                        longitude: parseCoord(riderCoords.longitude),
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
            } {/* Offers overlay - minimal UI change (does not alter main layout) */}
            {offers.length > 0 && (
                <View style={{
                    position: 'absolute',
                    bottom: 110,
                    left: 12,
                    right: 12,
                    zIndex: 999,
                    backgroundColor: '#fff',
                    padding: 10,
                    borderRadius: 8,
                    elevation: 6
                }}>
                    {offers.map(offer => (
                        <View key={`${offer._id}_${offer.riderId}`} style={{
                            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6
                        }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: '600' }}>Offer: ₹{Number(offer.price ?? 0).toFixed(2)}</Text>
                                <Text style={{ fontSize: 12, color: '#444' }}>Rider: {offer.riderInfo?.name ?? offer.riderId ?? 'Unknown'}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => acceptOffer(offer)}
                                style={{ backgroundColor: '#228B22', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginLeft: 8 }}>
                                <Text style={{ color: '#fff', fontWeight: '600' }}>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}
        </View>
    )
}

export default memo(LiveRide)