import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native'
import React, { memo, useCallback, useMemo, useState } from 'react'
import { useUserStore } from '@/store/userStore';
import { useRoute } from '@react-navigation/native';
import { rideStyles } from '@/styles/rideStyles';
import { StatusBar } from 'expo-status-bar';
import { calculateDistance, calculateFare } from '@/utils/mapUtils';
import RoutesMap from '@/components/customer/RoutesMap';
import CustomText from '@/components/shared/customText';
import { riderStyles } from '@/styles/riderStyles';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { router } from 'expo-router';
import { commonStyles } from '@/styles/commonStyles';
import CustomButton from '@/components/shared/customButton';
import { createRide } from '@/service/rideService';
import { UseWS } from '@/service/WSProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
const RideBooking = () => {


  const route = useRoute() as any;
  const item = route?.params as any
  const { location } = useUserStore() as any;
  const [selectedOption, setSelectedOption] = useState("Bike");
  const [loading, setLoading] = useState(false);

  const { emit } = UseWS() as any;
  const farePrices = useMemo(() => calculateFare(parseFloat(item?.distanceInKm)), [item?.distanceInKm]);

  const rideOptions = useMemo(() => [
    {
      type: 'Bike',
      seats: 1,
      time: "1 min",
      dropTime: '4:28 pm',
      price: farePrices?.bike,
      isFastest: true,
      icon: require('@/assets/icons/bike.png'),
    },
    {
      type: 'Auto',
      seats: 3,
      time: "1 min",
      dropTime: '4:30 pm',
      price: farePrices?.auto,
      icon: require('@/assets/icons/auto.png'),
    },
    {
      type: 'Cab Economy',
      seats: 4,
      time: "1 min",
      dropTime: '4:36 pm',
      price: farePrices?.cabEconomy,
      icon: require('@/assets/icons/cab.png'),
    },
    {
      type: 'Cab Premium',
      seats: 4,
      time: "1 min",
      dropTime: '4:40 pm',
      price: farePrices?.cabPremium,
      icon: require('@/assets/icons/cab_premium.png'),
    }
  ], [farePrices]);

  const handleOptionSelect = useCallback((type: string) => {
    setSelectedOption(type);
  }, [])
  type RideType = 'bike' | 'auto' | 'cabEconomy' | 'cabPremium';
  const handleRideBooking = async () => {
    console.log('[RideBooking] handleRideBooking start, selectedOption:', selectedOption);
    setLoading(true)
    // await createRide({
    //   vehicle:
    //     selectedOption === 'Cab Economy' ? "cabEconomy" : selectedOption === 'Cab Premium' ? 'cabPremium' : selectedOption === 'Bike' ? "bike" : "auto",
    //   drop: {
    //     latitude: parseFloat(item.drop_latitude),
    //     longitude: parseFloat(item.drop_longitude),
    //     address: item?.drop_address,
    //   },
    //   pickup: {
    //     latitude: parseFloat(location.latitude),
    //     longitude: parseFloat(location.longitude),
    //     address: location.address,
    //   },

    // })

    // Calculate distance
    try {
      const distance = Number(
        calculateDistance(
          parseFloat(location.latitude),
          parseFloat(location.longitude),
          parseFloat(item.drop_latitude),
          parseFloat(item.drop_longitude)
        )
      );
      console.log('[RideBooking] calculated distance:', distance);

      const farePricesLocal = calculateFare(distance);

      const selectedVehicle: RideType =
        selectedOption === 'Cab Economy' ? 'cabEconomy'
          : selectedOption === 'Cab Premium' ? 'cabPremium'
            : selectedOption === 'Bike' ? 'bike'
              : 'auto';

      const fare = Number(farePricesLocal[selectedVehicle]);
      console.log('[RideBooking] selectedVehicle:', selectedVehicle, 'fare:', fare);

      if (isNaN(fare) || isNaN(distance)) {
        console.warn('[RideBooking] invalid fare or distance', { fare, distance });
        Alert.alert('Error', 'Could not calculate fare or distance. Please try again.');
        setLoading(false);
        return;
      }

      const payload = {
        vehicle: selectedVehicle,
        drop: {
          latitude: parseFloat(item.drop_latitude),
          longitude: parseFloat(item.drop_longitude),
          address: item?.drop_address,
        },
        pickup: {
          latitude: parseFloat(location.latitude),
          longitude: parseFloat(location.longitude),
          address: location.address,
        },
        fare: Number(fare),
        distance: Number(distance)
      };

      console.log('[RideBooking] calling createRide with payload:', payload);

      // create ride on server
      const resp = await createRide(payload);
      console.log('[RideBooking] createRide response:', resp);

      const ride = resp?.ride ?? resp;
      const rideId = ride?._id || ride?.id;
      console.log('[RideBooking] created rideId:', rideId);

      // navigate to LiveRide and pass ride object so UI shows immediately (no fetch)
      try {
        console.log('[RideBooking] navigating to LiveRide with ride object');
        router.replace({
          pathname: '/customer/liveride',
          params: { id: rideId, ride: JSON.stringify(ride) }
        });
      } catch (e) {
        console.warn('[RideBooking] navigation with ride object failed, falling back to id-only', e);
        router.replace({ pathname: '/customer/liveride', params: { id: rideId } });
      }

      // also emit ride:searching with full ride payload so riders that expect payload receive it
      try {
        console.log('[RideBooking] emitting ride:searching with ride payload');
        emit && emit('ride:searching', { rideId, ride, vehicle: ride.vehicle });
      } catch (e) {
        console.warn('[RideBooking] emit ride:searching error', e);
      }

      console.log('[RideBooking] handleRideBooking finished - waiting for offers');
    } catch (err: any) {
      console.error('[RideBooking] handle ride booking error', err);
      const msg = err?.data?.msg || err?.message || 'Failed to create ride';
      Alert.alert('Booking failed', String(msg));
    } finally {
      setLoading(false);
    }
  }
  return (
    <View style={rideStyles.container}>
      <StatusBar style='light' backgroundColor='orange' translucent={false} />
      {item?.drop_latitude && location?.latitude && (
        <RoutesMap
          drop={{
            latitude: parseFloat(item?.drop_latitude),
            longitude: parseFloat(item?.drop_longitude)
          }}
          pickup={{
            latitude: parseFloat(location?.latitude),
            longitude: parseFloat(location?.longitude)
          }}
        />
      )}
      <View style={rideStyles.rideSelectionContainer}>
        <View style={rideStyles?.offerContainer}>
          <CustomText fontSize={12} style={rideStyles.offerText}>
            You got ₹10 off 5 coins cashback!
          </CustomText>
        </View>
        <ScrollView contentContainerStyle={rideStyles.scrollContainer}
          showsVerticalScrollIndicator={false}>
          {rideOptions?.map((ride, index) => (
            <RideOption
              key={index}
              ride={ride}
              selected={selectedOption}
              onSelect={handleOptionSelect} />
          ))}
        </ScrollView>
      </View>
      <TouchableOpacity style={rideStyles.backButton}
        onPress={() => router.back()}>
        <MaterialIcons name='arrow-back-ios' size={RFValue(14)} style={{ left: 4 }} color='black' />
      </TouchableOpacity>
      <View style={rideStyles.bookingContainer}>
        <View style={commonStyles.flexRowBetween}>
          <View
            style={[rideStyles.couponContainer, { borderRightWidth: 1, borderRightColor: '#ccc' }]}>
            <Image
              source={require('@/assets/icons/rupee.png')}
              style={rideStyles?.icon} />
            <View>
              <CustomText fontFamily='Medium' fontSize={12}>Cash</CustomText>
              <CustomText fontFamily='Medium' fontSize={10} style={{ opacity: 0.7 }}>Far:{item?.distanceInKm}KM</CustomText>
            </View>
            <Ionicons name='chevron-forward' size={RFValue(14)} color='#777' />
          </View>
          <View style={rideStyles.couponContainer}>
            <Image
              source={require('@/assets/icons/coupon.png')}
              style={rideStyles.icon} />
            <View>
              <CustomText fontFamily='Medium' fontSize={12}>DHANOO</CustomText>
              <CustomText style={{ opacity: 0.7 }} fontFamily='Medium' fontSize={10}>Coupon Applied</CustomText>
            </View>
            <Ionicons name='chevron-forward' size={RFValue(14)} color='#777' />
          </View>
        </View>
        <CustomButton
          title="Book Ride"
          disabled={loading}
          loading={loading}
          onPress={handleRideBooking} />
      </View>
    </View>
  )
}

const RideOption = memo(({ ride, selected, onSelect }: any) => (
  <TouchableOpacity
    style={[rideStyles.rideOption,
    { borderColor: selected === ride.type ? '#222' : '#ddd' }]}
    onPress={() => onSelect(ride?.type)}
  >
    <View style={commonStyles.flexRowBetween}>
      <Image source={ride?.icon} style={rideStyles?.rideIcon} />
      <View style={rideStyles?.rideDetails}>
        <CustomText fontFamily='Medium' fontSize={12}>{ride?.type}{ride?.isFastest && <Text style={rideStyles.fastestLabel}>FASTEST</Text>}</CustomText>
        <CustomText fontSize={10}>
          {ride?.seats} seats ● {ride?.time} away ● Drop {ride?.dropTime}
        </CustomText>

      </View>
      <View style={rideStyles?.priceContainer}>
        <CustomText fontFamily='Medium' fontSize={14}>
          ₹{ride?.price?.toFixed(2)}
        </CustomText>
        {selected === ride.type && (
          <Text style={rideStyles?.discountedPrice}>
            ₹{Number(ride?.price + 10).toFixed(2)}
          </Text>
        )}
      </View>
    </View>
  </TouchableOpacity>
)
)

export default memo(RideBooking)
