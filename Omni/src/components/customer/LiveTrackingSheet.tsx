import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, Alert, Platform, ToastAndroid } from 'react-native'
import React, { FC, useEffect, useState } from 'react'
import { UseWS } from '@/service/WSProvider'
import { rideStyles } from '@/styles/rideStyles'
import { commonStyles } from '@/styles/commonStyles'
import { vehicleIcons } from '@/utils/mapUtils'
import CustomText from '../shared/customText'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { resetAndNavigate } from '@/utils/Helpers'
import OtpInputModal from '@/components/Rider/OtpInputModal'
import { cancelRide as apiCancelRide } from '@/service/rideService'


type VehicleType = 'bike' | 'auto' | 'cabEconomy' | 'cabPremium'

interface RideItem {
    vehicle?: VehicleType
    _id: string
    pickup?: { address: string }
    drop?: { address: string }
    fare?: number
    otp?: string
    rider: any
    status?: string
}
const LiveTrackingSheet: FC<{ item: RideItem }> = ({ item }) => {

    const { emit } = UseWS()
    const [showOtpModal, setShowOtpModal] = useState(false)
    const [showHappyModal, setShowHappyModal] = useState(false)
    const [showCompletedModal, setShowCompletedModal] = useState(false)

    const [cancelling, setCancelling] = useState(false)

    const handleCancelPress = async () => {
        const rideId = item?._id
        if (!rideId) {
            Alert.alert('Cannot cancel', 'No ride id available')
            return
        }
        try {
            setCancelling(true)
            console.log('[LiveTrackingSheet] cancelling ride', rideId)
            const resp = await apiCancelRide(String(rideId))
            console.log('[LiveTrackingSheet] cancel response', resp?.data ?? resp)

            // best-effort socket notify / unsubscribe
            try { emit && emit('unsubscribeRide', { rideId: String(rideId) }) } catch (e) { console.warn('[LiveTrackingSheet] emit unsubscribeRide failed', e) }
            try { emit && emit('ride:cancelled', { rideId: String(rideId), by: 'customer' }) } catch (e) { console.warn('[LiveTrackingSheet] emit ride:cancelled failed', e) }

            try {
                if (Platform.OS === 'android') ToastAndroid.show('Ride offer cancelled', ToastAndroid.SHORT)
                else Alert.alert('Ride offer cancelled')
            } catch (e) { console.warn('[LiveTrackingSheet] toast failed', e) }

            // navigate home and clear active ride UI
            resetAndNavigate('/customer/home')
        } catch (err: any) {
            console.warn('[LiveTrackingSheet] cancel error', err)
            Alert.alert('Cancel failed', err?.response?.data?.message ?? err?.message ?? 'Failed to cancel ride')
        } finally {
            setCancelling(false)
        }
    }

    // react to status changes and show proper overlays/modals
    useEffect(() => {
        const s = item?.status?.toUpperCase?.() || ''

        // when rider accepted and heading to pickup -> show OTP modal for customer to confirm
        if (s === 'ARRIVING') {
            setShowOtpModal(true)
            setShowHappyModal(false)
            setShowCompletedModal(false)
            return
        }

        // once OTP confirmed / after pickup — show "Happy Journey" while trip is ongoing
        if (s === 'ARRIVED' || s === 'START' || s === 'ON_TRIP' || s === 'IN_PROGRESS') {
            setShowOtpModal(false)
            setShowHappyModal(true)
            setShowCompletedModal(false)
            return
        }

        // final completed state
        if (s === 'COMPLETED') {
            setShowOtpModal(false)
            setShowHappyModal(false)
            setShowCompletedModal(true)
            return
        }

        // default: hide all
        setShowOtpModal(false)
        setShowHappyModal(false)
        setShowCompletedModal(false)
    }, [item?.status, item?.otp])

    return (
        <View>
            <View style={rideStyles?.headerContainer}>
                <View style={commonStyles.flexRowGap}>
                    {item.vehicle && (
                        <Image
                            source={vehicleIcons[item.vehicle]?.icon}
                            style={rideStyles?.rideIcon} />
                    )}
                    <View>
                        {/* <CustomText fontSize={10}>
                            {item?.status === 'START' ? 'Ride near you' : item?.status === 'ARRIVED' ? 'Rider Arrived , HAPPY JOURNEY' : 'WOHOO 🥳🎉'}
                        </CustomText>
                        <CustomText>
                            {item?.status === 'START' ? `OTP - ${item.otp}` : " "}
                        </CustomText> */}
                        <CustomText fontSize={10}>
                            {item?.status === 'START' ? 'Ride near you'
                                : item?.status === 'ARRIVING' ? 'Rider is arriving — verify OTP'
                                    : item?.status === 'ARRIVED' || item?.status === 'START' || item?.status === 'IN_PROGRESS' ? 'Rider Arrived , HAPPY JOURNEY'
                                        : item?.status === 'COMPLETED' ? 'WOHOO 🥳🎉' : 'WOHOO 🥳🎉'}
                        </CustomText>
                        <CustomText>
                            {/* show OTP inline for quick glance when arriving */}
                            {item?.status === 'ARRIVING' ? `OTP - ${item.otp ?? ''}` : " "}
                        </CustomText>
                    </View>
                </View>

                {item?.rider?.phone && (
                    <CustomText fontSize={11} numberOfLines={1} fontFamily='Medium'>
                        +91 {" "}
                        {item?.rider?.phone &&
                            item?.rider?.phone?.slice(0, 5) + " " + item?.rider?.phone?.slice(5)}
                    </CustomText>
                )}
            </View>
            <View style={{ padding: 10 }}>
                <CustomText fontFamily='SemiBold' fontSize={12}>Location Details</CustomText>

                <View style={[commonStyles.flexRowGap, { marginVertical: 15, width: '90%' }]}>
                    <Image source={require('@/assets/icons/marker.png')}
                        style={rideStyles.pinIcon} />
                    <CustomText fontSize={10} numberOfLines={2}>
                        {item?.pickup?.address}
                    </CustomText>
                </View>
                <View style={[commonStyles.flexRowGap, { width: "90%" }]}>
                    <Image source={require('@/assets/icons/drop_marker.png')}
                        style={rideStyles.pinIcon} />
                    <CustomText fontSize={10} numberOfLines={2}>
                        {item?.drop?.address}
                    </CustomText>
                </View>
                <View style={{ marginVertical: 20 }}>
                    <View style={[commonStyles.flexRowBetween]}>
                        <View style={commonStyles.flexRow}>
                            <MaterialCommunityIcons
                                name='credit-card'
                                size={24}
                                color='black' />
                            <CustomText style={{ marginLeft: 10 }}
                                fontFamily='SemiBold'
                                fontSize={12}>Payment
                            </CustomText>
                        </View>
                        <CustomText fontSize={14} fontFamily='SemiBold'>₹{item.fare?.toFixed(2)}</CustomText>
                    </View>
                    <CustomText fontSize={10}>Payment via cash</CustomText>
                </View>
            </View>
            <View style={rideStyles.bottomButtonContainer}>
                {item?.status === 'ARRIVING' ?
                    (
                        <TouchableOpacity
                            style={rideStyles.cancelButton}
                            onPress={handleCancelPress}>
                            <CustomText style={rideStyles.cancelButtonText}>Cancel Ride</CustomText>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={rideStyles.cancelButton}
                            onPress={() => { resetAndNavigate('/customer/home') }}>
                            <CustomText style={rideStyles.cancelButtonText}>Home</CustomText>
                        </TouchableOpacity>
                    )
                }
            </View>

        </View >

    )
}

export default LiveTrackingSheet