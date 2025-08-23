import { View, Text, Image, ActivityIndicator, TouchableOpacity } from 'react-native'
import React, { FC, useEffect } from 'react'
import { UseWS } from '@/service/WSProvider'
import { rideStyles } from '@/styles/rideStyles'
import { commonStyles } from '@/styles/commonStyles'
import { vehicleIcons } from '@/utils/mapUtils'
import CustomText from '../shared/customText'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'


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
    useEffect(() => {
        // debug: print full ride item and coordinate types to console
        console.log('[SearchingRideSheet] item received:', item)
        console.log('[SearchingRideSheet] pickup coords:', item?.pickup?.latitude, item?.pickup?.longitude, 'types:', typeof item?.pickup?.latitude, typeof item?.pickup?.longitude)
        console.log('[SearchingRideSheet] drop coords:', item?.drop?.latitude, item?.drop?.longitude, 'types:', typeof item?.drop?.latitude, typeof item?.drop?.longitude)
    }, [item])
    const { emit } = UseWS()
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
                <TouchableOpacity
                    style={rideStyles?.cancelButton}
                    onPress={() => {
                        emit('CANCEL RIDE', item?._id)
                        router.replace('/customer/home')
                        console.log('Ride cancelled:', item?._id)
                    }}>
                    <CustomText style={rideStyles?.cancelButtonText}>Cancel</CustomText>
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