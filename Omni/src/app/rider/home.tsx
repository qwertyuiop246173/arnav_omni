import { View, Text, Image, Alert, StyleSheet, TouchableOpacity, Platform, ToastAndroid } from 'react-native'
import React, { useEffect, useRef, useState } from 'react'
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
import AsyncStorage from '@react-native-async-storage/async-storage'

const RiderHome = () => {

  const isFocused = useIsFocused()
  const { emit, on, off, socket } = UseWS()
  const userStore = useUserStore?.() as any;
  const riderId = userStore?.user?._id || null;
  const { onDuty, setLocation, location } = useRiderStore() as any
  const [rideOffers, setRideOffers] = useState<any[]>([])
  // vehicle choices must match those used by customers: 'bike','auto','cabEconomy','cabPremium' etc.
  const VEHICLES = ['bike', 'auto', 'cabEconomy', 'cabPremium'];
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const selectedVehicle = selectedIdx !== null ? VEHICLES[selectedIdx] : '';
  const [lastLoaded, setLastLoaded] = useState(false);
  const prevOnDutyRef = useRef<boolean>(false)
  const LAST_VEHICLE_KEY = 'rider:lastSelectedVehicle'
  // restore last selected vehicle when Home mounts
  useEffect(() => {
    const loadLast = async () => {
      try {
        const v = await AsyncStorage.getItem(LAST_VEHICLE_KEY)
        if (v !== null) {
          const idx = Number(v)
          if (!Number.isNaN(idx) && idx >= 0 && idx < VEHICLES.length) {
            setSelectedIdx(idx)
            console.log('[RiderHome] restored last selected vehicle idx=', idx, 'vehicle=', VEHICLES[idx])
          }
        }
      } catch (e) {
        console.warn('[RiderHome] failed to load last vehicle', e)
      } finally {
        // mark load complete so toast logic can rely on restored selection
        setLastLoaded(true)
      }
    }
    loadLast()
  }, [])

  // helper to select vehicle and persist choice
  const selectVehicle = async (idx: number) => {
    setSelectedIdx(idx)
    try {
      await AsyncStorage.setItem(LAST_VEHICLE_KEY, String(idx))
      console.log('[RiderHome] saved last selected vehicle idx=', idx)
    } catch (e) {
      console.warn('[RiderHome] failed to save last vehicle', e)
    }
  }
  // once persisted choice is loaded, initialize prevOnDutyRef to current onDuty
  // this prevents the "go ON-DUTY" toast firing immediately when Home mounts
  // useEffect(() => {
  //   if (!lastLoaded) return
  //   prevOnDutyRef.current = onDuty
  //   console.log('[RiderHome] prevOnDutyRef initialized ->', prevOnDutyRef.current)
  // }, [lastLoaded, onDuty])
  // useEffect(() => {
  //   // wait until persisted vehicle is loaded to decide showing the toast
  //   if (!lastLoaded) return

  //   // only show toast when transitioning ON-DUTY, screen focused, AND no vehicle already selected
  //   if (onDuty && !prevOnDutyRef.current && isFocused && !selectedVehicle) {
  //     const msg = 'Select the vehicle you are riding. Only then you will start receiving ride offers'
  //     if (Platform.OS === 'android') {
  //       ToastAndroid.show(msg, ToastAndroid.LONG)
  //     } else {
  //       Alert.alert('On Duty', msg)
  //     }
  //   }
  //   prevOnDutyRef.current = onDuty
  // }, [onDuty, isFocused, lastLoaded, selectedVehicle])

  // show toast whenever rider is ON-DUTY, screen focused and no vehicle selected
  // wait until persisted selection (lastLoaded) is restored to avoid false alerts on mount
  useEffect(() => {
    if (!lastLoaded) return
    if (onDuty && isFocused && !selectedVehicle) {
      const msg = 'Select the vehicle you are riding. Only then you will start receiving ride offers'
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.LONG)
      } else {
        Alert.alert('Select vehicle', msg)
      }
    }
  }, [onDuty, isFocused, lastLoaded, selectedVehicle])

  // emit selection when changed
  useEffect(() => {
    try {
      // console.log('[RiderHome] emitting rider:setVehicle', selectedVehicle);
      // emit && emit('rider:setVehicle', selectedVehicle);
      if (selectedVehicle) {
        console.log('[RiderHome] emitting rider:setVehicle', selectedVehicle);
        emit && emit('rider:setVehicle', selectedVehicle);
      } else {
        console.log('[RiderHome] no vehicle selected yet - not emitting rider:setVehicle');
      }
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
  // reorder offers so those matching selectedVehicle are shown first
  const displayOffers = (() => {
    if (!onDuty) return []
    if (!selectedVehicle) return [] // hide offers until vehicle selected
    const matched = rideOffers.filter(p => (p.vehicle || '').toString() === selectedVehicle)
    const others = rideOffers.filter(p => (p.vehicle || '').toString() !== selectedVehicle)
    return [...matched, ...others]
  })()
  return (
    <View style={homeStyles.container}>
      <StatusBar style="light" backgroundColor='orange' translucent={false} />
      <RiderHeader />
      <View>
        {onDuty ? (
          <View style={styles.vehicleContainer}>
            {VEHICLES.map((v, i) => {
              const active = i === selectedIdx
              const labelMap: Record<string, string> = { bike: 'Bike', auto: 'Auto', cabEconomy: 'Cab-E', cabPremium: 'Cab-P' }
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.vehicleBtn, active ? styles.vehicleBtnActive : null]}
                  onPress={() => {
                    selectVehicle(i)
                    console.log('[RiderHome] vehicle selected=', v)
                  }}
                >
                  <Text style={[styles.vehicleText, active ? styles.vehicleTextActive : null]}>{labelMap[v] || v}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ) : null}
      </View>

      <FlatList
        data={displayOffers}
        renderItem={renderRides}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 88, paddingBottom: 120, paddingHorizontal: 10 }}
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
  },
  vehicleContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,           // span full width with left/right padding
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between' // distribute space across row
  },
  vehicleBtn: {
    flex: 1,                    // each button takes equal width
    marginHorizontal: 6,        // small gap between buttons
    paddingVertical: 8,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4
  },
  vehicleBtnActive: {
    backgroundColor: '#3C75BE'
  },
  vehicleText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 12
  },
  vehicleTextActive: {
    color: '#fff'
  }
});
export default RiderHome