import { View, Text, Image, ActivityIndicator, TouchableOpacity, Alert, Platform, ToastAndroid } from 'react-native'
import React, { FC, useEffect, useRef, useState } from 'react'
import { UseWS } from '@/service/WSProvider'
import { rideStyles } from '@/styles/rideStyles'
import { commonStyles } from '@/styles/commonStyles'
import { vehicleIcons } from '@/utils/mapUtils'
import CustomText from '../shared/customText'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { cancelRide as apiCancelRide } from '@/service/rideService'

type VehicleType = 'bike' | 'auto' | 'cabEconomy' | 'cabPremium'

// interface RideItem {
//     vehicle?: VehicleType
//     _id: string
//     pickup?: { address: string }
//     drop?: { address: string }
//     fare?: number
// }
interface RideItem {
    vehicle?: VehicleType
    _id: string
    pickup?: { address: string, latitude?: number | string, longitude?: number | string }
    drop?: { address: string, latitude?: number | string, longitude?: number | string }
    fare?: number
}
const SearchingRideSheet: FC<{ item: RideItem }> = ({ item }) => {
    const cancelledRef = useRef(false)
    useEffect(() => {
        // debug: print full ride item and coordinate types to console
        console.log('[SearchingRideSheet] item received:', item)
        console.log('[SearchingRideSheet] pickup coords:', item?.pickup?.latitude, item?.pickup?.longitude, 'types:', typeof item?.pickup?.latitude, typeof item?.pickup?.longitude)
        console.log('[SearchingRideSheet] drop coords:', item?.drop?.latitude, item?.drop?.longitude, 'types:', typeof item?.drop?.latitude, typeof item?.drop?.longitude)
    }, [item])
    const { emit, off } = UseWS()
    const [loading, setLoading] = useState(false)

    const handleCancelPress = async () => {
        const rideId = item?._id
        if (!rideId) { Alert.alert('Cannot cancel', 'No ride id available'); return }

        try {
            setLoading(true)
            console.log('[SearchingRideSheet] cancelling ride', rideId)
            const resp = await apiCancelRide(String(rideId))
            console.log('[SearchingRideSheet] cancel response', resp?.data ?? resp)

            // mark cancelled locally so other local handlers can check
            cancelledRef.current = true

            // remove global socket listeners immediately so background handlers don't react
            try {
                off && off('rideUpdate')
                off && off('ride:no_rider')
                off && off('ride:cancelled')
                console.log('[SearchingRideSheet] removed global socket listeners before navigation')
            } catch (e) {
                console.warn('[SearchingRideSheet] off() error', e)
            }

            // tell server we unsubscribe / best-effort notify
            try { emit && emit('unsubscribeRide', { rideId: String(rideId) }) } catch (e) { console.warn('[SearchingRideSheet] emit unsubscribeRide failed', e) }
            try { emit && emit('ride:cancelled', { rideId: String(rideId), by: 'customer' }) } catch (e) { console.warn('[SearchingRideSheet] emit ride:cancelled failed', e) }

            try {
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Ride offer cancelled', ToastAndroid.SHORT)
                } else {
                    Alert.alert('Ride offer cancelled')
                }
            } catch (e) {
                console.warn('[SearchingRideSheet] toast failed', e)
            }
            router.replace('/customer/home')
        } catch (err: any) {
            console.warn('[SearchingRideSheet] cancel error', err)
            Alert.alert('Cancel failed', err?.response?.data?.message ?? err.message ?? 'Failed to cancel ride')
        } finally {
            setLoading(false)
        }
    }
    return (
        <View>
            <View style={rideStyles?.headerContainer}>
                <View style={commonStyles.flexRowBetween}>
                    {item?.vehicle && (
                        <Image
                            source={vehicleIcons[item.vehicle]?.icon}
                            style={rideStyles?.rideIcon} />
                    )}
                    <View style={{ marginLeft: 10 }}>
                        <CustomText fontSize={10}>Looking for your </CustomText>
                        <CustomText fontFamily='Medium' fontSize={12}>
                            {item?.vehicle} ride
                        </CustomText>
                    </View>
                </View>
                <ActivityIndicator color='black' size='small' />
            </View>
            <View>
                <CustomText fontFamily='SemiBold' fontSize={12}>Location Details</CustomText>
            </View>
            <View style={[commonStyles?.flexRowGap, { marginVertical: 15, width: '90%' }]}>
                <Image
                    source={require('@/assets/icons/marker.png')}
                    style={rideStyles?.pinIcon} />
                <CustomText fontSize={10} numberOfLines={2}>
                    {item?.pickup?.address}
                </CustomText>
            </View>
            <View style={[commonStyles.flexRowGap, { width: "90%" }]}>
                <Image source={require('@/assets/icons/drop_marker.png')} style={rideStyles?.pinIcon} />
                <CustomText fontSize={10} numberOfLines={2}>
                    {item?.drop?.address}
                </CustomText>
            </View>

            <View style={{ marginVertical: 20 }}>
                <View style={[commonStyles.flexRowBetween]}>
                    <View style={[commonStyles.flexRow]}>
                        <MaterialCommunityIcons
                            name='credit-card'
                            size={24}
                            color='black'
                        />
                        <CustomText
                            style={{ marginLeft: 10 }}
                            fontFamily='SemiBold'
                            fontSize={12}>Payment</CustomText>
                        <CustomText fontSize={14} fontFamily='SemiBold'>
                            ₹ {item?.fare?.toFixed(2)}
                        </CustomText>
                    </View>
                    <CustomText fontSize={10}>Payment Via Cash</CustomText>
                </View>
            </View>
            <View style={rideStyles?.bottomButtonContainer}>
                {/* <TouchableOpacity
                    style={rideStyles?.cancelButton}
                    onPress={() => {
                        emit('CANCEL RIDE', item?._id)
                        router.replace('/customer/home')
                        console.log('Ride cancelled:', item?._id)
                    }}>
                    <CustomText style={rideStyles?.cancelButtonText}>Cancel</CustomText>
                </TouchableOpacity> */}
                <TouchableOpacity
                    style={rideStyles?.cancelButton}
                    onPress={handleCancelPress}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <CustomText style={rideStyles?.cancelButtonText}>Cancel</CustomText>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={rideStyles.backButton2}
                    onPress={() => router.back()}>
                    <CustomText style={rideStyles?.backButtonText}>Back</CustomText>
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default SearchingRideSheet