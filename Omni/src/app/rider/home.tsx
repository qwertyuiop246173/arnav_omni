import { View, Text, Image, Alert, StyleSheet, TouchableOpacity } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'
import { UseWS } from '@/service/WSProvider'
import { useRiderStore } from '@/store/riderStore'
import { getMyRides } from '@/service/rideService'
import * as Location from 'expo-location'
import { homeStyles } from '@/styles/homeStyles'
import { StatusBar } from 'expo-status-bar'
import RiderHeader from '@/components/Rider/RiderHeader'
import { FlatList } from 'react-native-gesture-handler'
import { riderStyles } from '@/styles/riderStyles'
import CustomText from '@/components/shared/customText'
import RiderRidesItem from '@/components/Rider/RiderRidesItem'
import { useUserStore } from '@/store/userStore'
import { calculateDistance } from '@/utils/mapUtils'

const RiderHome = () => {

  const isFocused = useIsFocused()
  const { emit, on, off, socket } = UseWS()
  const userStore = useUserStore?.() as any;
  const riderId = userStore?.user?._id || null;
  const { onDuty, setLocation, location } = useRiderStore() as any
  const [rideOffers, setRideOffers] = useState<any[]>([])
  // vehicle choices must match those used by customers: 'bike','auto','cabEconomy','cabPremium' etc.
  const VEHICLES = ['bike', 'auto', 'cabEconomy', 'cabPremium'];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedVehicle = VEHICLES[selectedIdx];

  // emit selection when changed
  useEffect(() => {
    try {
      console.log('[RiderHome] emitting rider:setVehicle', selectedVehicle);
      emit && emit('rider:setVehicle', selectedVehicle);
    } catch (e) {
      console.warn('[RiderHome] emit rider:setVehicle failed', e);
    }
  }, [selectedVehicle, emit]);

  // handle incoming ride requests -> add to rideOffers so RiderRidesItem shows
  useEffect(() => {
    const handleNewRequest = (payload: any) => {
      try {
        console.log('[RiderHome] received ride:new_request', payload);
        const ride = payload?.ride ?? payload
        const rideId = payload?.rideId || ride?._id || ride?.id || Math.random().toString()
        const customerSocketId = payload?.customerSocketId
        const fare = ride?.fare ?? ride?.price ?? 0
        // normalize item shape to what RiderRidesItem expects
        const item = {
          _id: rideId,
          id: rideId,
          vehicle: ride?.vehicle ?? ride?.vehicleType,
          pickup: {
            address: ride?.pickup?.address ?? ride?.pickupAddress ?? '',
            latitude: Number(ride?.pickup?.latitude ?? ride?.pickup_latitude ?? 0),
            longitude: Number(ride?.pickup?.longitude ?? ride?.pickup_longitude ?? 0)
          },
          drop: {
            address: ride?.drop?.address ?? ride?.dropAddress ?? '',
            latitude: Number(ride?.drop?.latitude ?? ride?.drop_latitude ?? 0),
            longitude: Number(ride?.drop?.longitude ?? ride?.drop_longitude ?? 0)
          },
          fare: Number(fare),
          distance: Number(ride?.distance ?? ride?.distanceInKm ?? 0),
          customerSocketId,
          raw: ride
        }

        // compute distance from rider to pickup if location available (for display fallback)
        if ((item.distance === 0 || Number.isNaN(item.distance)) && location?.latitude) {
          try {
            const d = calculateDistance(
              item.pickup.latitude || 0,
              item.pickup.longitude || 0,
              item.drop.latitude || 0,
              item.drop.longitude || 0
            )
            item.distance = Number(d) || 0
            console.log('[RiderHome] computed fallback distance', item.distance)
          } catch (e) {
            console.warn('[RiderHome] compute distance failed', e)
          }
        }

        // append if not already present
        setRideOffers(prev => {
          const exists = prev.some(p => p._id === item._id)
          if (exists) {
            console.log('[RiderHome] ride already in list, skipping append', item._id)
            return prev
          }
          console.log('[RiderHome] appending ride offer to list', item._id)
          return [item, ...prev]
        })
      } catch (err) {
        console.error('[RiderHome] handleNewRequest error', err);
      }
    };

    on && on('ride:new_request', handleNewRequest);
    console.log('[RiderHome] registered ride:new_request listener');

    return () => {
      try {
        off && off('ride:new_request')
        console.log('[RiderHome] removed ride:new_request listener');
      } catch (e) {
        console.warn('[RiderHome] cleanup ride:new_request listener failed', e);
      }
    };
  }, [on, off, emit, selectedVehicle, socket?.id, riderId, location]);

  // also listen for legacy 'rideOffers' event (server or other code may emit this)
  useEffect(() => {
    const handleLegacyOffers = (rideDetails: any) => {
      try {
        console.log('[RiderHome] received legacy rideOffers', rideDetails);
        const item = {
          _id: rideDetails?.id || rideDetails?._id || Math.random().toString(),
          id: rideDetails?.id,
          vehicle: rideDetails?.vehicle,
          pickup: rideDetails?.pickup,
          drop: rideDetails?.drop,
          fare: rideDetails?.fare,
          distance: rideDetails?.distance ?? 0,
          raw: rideDetails
        }
        setRideOffers(prev => {
          if (prev.some(p => p._id === item._id)) return prev
          console.log('[RiderHome] appending legacy ride offer', item._id)
          return [item, ...prev]
        })
      } catch (e) {
        console.warn('[RiderHome] handleLegacyOffers error', e)
      }
    }

    if (onDuty && isFocused) {
      on && on('rideOffers', handleLegacyOffers);
      console.log('[RiderHome] registered rideOffers listener (legacy)')
    }

    return () => {
      try { off && off('rideOffers'); console.log('[RiderHome] removed rideOffers listener (legacy)') } catch (e) { }
    }
  }, [onDuty, on, off, isFocused])

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    const startLocationUpdates = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
          },
          (locationUpdate) => {
            const { latitude, longitude, heading } = locationUpdate.coords
            setLocation({
              latitude: latitude,
              longitude: longitude,
              address: "Somewhere",
              heading: heading as number,
            })
            emit('updateLocation', {
              latitude, longitude, heading
            })
            console.log('[RiderHome] emitted updateLocation', { latitude, longitude, heading })
          }
        )
      }
    }

    if (onDuty && isFocused) {
      startLocationUpdates()
    }
    return () => {
      if (locationSubscription) {
        locationSubscription.remove()
      }
    }
  }, [onDuty, isFocused])

  const removeRide = (id: string) => {
    setRideOffers((prevOffers) => prevOffers.filter((offer) => offer._id !== id));
    console.log('[RiderHome] removed ride offer', id)
  };

  const renderRides = ({ item }: any) => {
    return (
      <RiderRidesItem removeIt={() => removeRide(item?._id)} item={item} />
    );
  }

  return (
    <View style={homeStyles.container}>
      <StatusBar style="light" backgroundColor='orange' translucent={false} />
      <RiderHeader />
      <View style={styles.pillContainer}>
        <TouchableOpacity
          style={styles.pill}
          onPress={() => {
            const next = (selectedIdx + 1) % VEHICLES.length;
            setSelectedIdx(next);
            console.log('[RiderHome] vehicle pill pressed new selection=', VEHICLES[next]);
          }}
        >
          <Text style={styles.pillText}>{selectedVehicle.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={!onDuty ? [] : rideOffers}
        renderItem={renderRides}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120, padding: 10 }}
        keyExtractor={(item: any) => item?.id || Math.random().toString()}
        ListEmptyComponent={
          <View style={riderStyles?.emptyContainer}>
            <Image
              source={require('@/assets/icons/ride.jpg')}
              style={riderStyles?.emptyImage} />
            <CustomText
              fontSize={12}
              style={{ textAlign: 'center' }}>
              {onDuty
                ? "There are no available rides ! Stay Active" :
                "You're currently OFF-DUTY , please go ON-DUTY to start earning"}
            </CustomText>
          </View>
        }
      />
    </View>
  )
}
const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute',
    top: 16,
    right: 12,
    zIndex: 999
  },
  pill: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4
  },
  pillText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 12
  }
});

export default RiderHome