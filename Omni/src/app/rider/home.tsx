import { View, Text, Image } from 'react-native'
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


const RiderHome = () => {

  const isFocused = useIsFocused()
  const { emit, on, off } = UseWS()
  const { onDuty, setLocation } = useRiderStore()
  const [rideOffers, setRideOffers] = useState<any[]>([])

  useEffect(() => {
    getMyRides(false)
  }, [])

  useEffect(() => {
    // let locationSubscription: any
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
          (location) => {
            const { latitude, longitude, heading } = location.coords
            setLocation({
              latitude: latitude,
              longitude: longitude,
              address: "Somewhere",
              heading: heading as number,
            })
            emit('updateLocation', {
              latitude, longitude, heading

            })
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


  useEffect(() => {
    if (onDuty && isFocused) {
      on('rideOffers', (rideDetails: any) => {
        setRideOffers((prevOffers) => {
          const existingIds = new Set(prevOffers?.map(offer => offer?.id));
          if (!existingIds.has(rideDetails?.id)) {
            return [...prevOffers, rideDetails];
          }
          return prevOffers;
        });
      });
    }
    return () => {
      off('rideOffers')
    }
  }, [onDuty, on, off, isFocused])

  const removeRide = (id: string) => {
    setRideOffers((prevOffers) => prevOffers.filter((offer) => offer.id !== id));
  };

  const renderRides = ({ item }: any) => {
    return (
      <RiderRidesItem removeIt={() => removeRide(item?.id)} item={item} />
    );
  }

  return (
    <View style={homeStyles.container}>
      <StatusBar style="light" backgroundColor='orange' translucent={false} />
      <RiderHeader />
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

export default RiderHome