import { UseWS } from '@/service/WSProvider'
import { useUserStore } from '@/store/userStore'
import { customMapStyle, indiaIntialRegion } from '@/utils/CustomMap'
import { reverseGeocode } from '@/utils/mapUtils'
import { useIsFocused } from '@react-navigation/native'
import { FC, memo, useEffect, useRef, useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import MapView, { Marker, Region } from 'react-native-maps'
import haversine from 'haversine-distance'
import { FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons'
import { mapStyles } from '@/styles/mapStyles'
import { RFValue } from 'react-native-responsive-fontsize'
import * as Location from 'expo-location'
const DraggableMap: FC<{ height: number }> = ({ height }) => {
    const isFocused = useIsFocused()
    const [marker, setMarker] = useState<any>([])
    const mapRef = useRef<MapView>(null)
    const { setLocation, location, outOfRange, setOutOfRange } = useUserStore()
    const { emit, on, off } = UseWS()
    const MAX_DISTANCE_THRESHOLD = 10000 // in meters

    useEffect(() => {
        (async () => {
            if (isFocused) {
                const { status } = await Location.requestForegroundPermissionsAsync()
                if (status === 'granted') {
                    try {
                        const location = await Location.getCurrentPositionAsync({})
                        const { latitude, longitude } = location.coords
                        mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
                            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                            animated: true
                        })
                        const newRegion = {
                            latitude,
                            longitude,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01
                        }
                        handleRegionChangeComplete(newRegion)
                        mapRef.current?.animateToRegion(newRegion, 500)
                    } catch (error) {
                        console.error("Error getting current Location:", error)
                    }
                } else {
                    console.log("Permission to access location was denied")
                }
            }
        })()
    }, [mapRef, isFocused])

    // Realtime Nearby Riders
    useEffect(() => {
        if (location?.latitude && location?.longitude && outOfRange) {
            emit("subscribeToZone", {
                latitude: location.latitude,
                longitude: location.longitude,

            })

            on("nearbyRiders", (riders: any[]) => {
                const updateMarkers = riders.map((rider) => ({
                    id: rider.id,
                    latitude: rider.coords.latitude,
                    longitude: rider.coords.longitude,
                    type: 'rider',
                    rotation: rider.coords.heading,
                    visible: true
                }))
                setMarker(updateMarkers)
            })
        }
        return () => {
            off('nearbyriders')
        }
    }, [location, emit, on, off, isFocused])



    // const generateRandomMarkers = () => { //simuating nearby rider
    //     if (!location?.latitude || !location?.longitude || outOfRange) return;
    //     const types = ['bike', 'auto', 'cab']
    //     const newMarkers = Array.from({ length: 20 }, (_, index) => {
    //         const randomType = types[Math.floor(Math.random() * types.length)]
    //         const randomRotation = Math.floor(Math.random() * 360)
    //         return {
    //             id: index,
    //             latitude: location?.latitude + (Math.random() - 0.5) * 0.01,
    //             longitude: location?.longitude + (Math.random() - 0.5) * 0.01,
    //             type: randomType,
    //             rotation: randomRotation,
    //             visible: true
    //         }
    //     })
    //     setMarker(newMarkers)
    // }

    // useEffect(() 



    const handleRegionChangeComplete = async (newRegion: Region) => {
        const address = await reverseGeocode(newRegion.latitude,
            newRegion.longitude)
        setLocation({
            address: address,
            latitude: newRegion.latitude,
            longitude: newRegion.longitude
        })
        const userLocation = {
            latitude: location?.latitude,
            longitude: location?.longitude
        } as any;
        if (userLocation) {
            const newLocation = {
                latitude: newRegion.latitude,
                longitude: newRegion.longitude
            }
            const distance = haversine(userLocation,
                newLocation)
            setOutOfRange(distance > MAX_DISTANCE_THRESHOLD)
        }
    }

    const handleGpsButtonPress = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync()
            const location = await Location.getCurrentPositionAsync({})
            const { latitude, longitude } = location.coords;
            mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true
            })
            const closerRegion = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            mapRef.current?.animateToRegion(closerRegion, 500)
            const address = await reverseGeocode(latitude, longitude)
            setLocation({ latitude, longitude, address })

        }
        catch (error) {
            console.error("Error getting location: ", error)
        }
    }

    return (
        <View style={{ height: height, width: '100%' }}>
            <MapView
                ref={mapRef}
                maxZoomLevel={19}
                minZoomLevel={12}
                pitchEnabled={false}
                onRegionChangeComplete={handleRegionChangeComplete}
                style={{ flex: 1 }}
                initialRegion={indiaIntialRegion}
                provider='google'
                showsMyLocationButton={false}
                showsCompass={false}
                showsIndoors={false}
                showsIndoorLevelPicker={false}
                showsTraffic={false}
                showsScale={false}
                showsBuildings={false}
                customMapStyle={customMapStyle}
                showsUserLocation={true}
            >
                {marker?.filter((marker: any) => marker?.latitude && marker.longitude && marker.visible).map((marker: any, index: number) => (
                    <Marker
                        key={index}
                        zIndex={index + 1}
                        flat
                        anchor={{ x: 0.5, y: 0.5 }}
                        coordinate={{
                            latitude: marker.latitude,
                            longitude: marker?.longitude
                        }}>
                        <View style={{ transform: [{ rotate: `${marker?.rotation}deg` }] }}>
                            <Image
                                source={
                                    marker.type === 'bike'
                                        ? require("@/assets/icons/bike_marker.png")
                                        : marker.type === 'auto'
                                            ? require('@/assets/images/auto_marker.png')
                                            : require('@/assets/images/cab_marker.png')
                                }
                                style={{ height: 40, width: 40, resizeMode: 'contain' }} />
                        </View>
                    </Marker>
                ))}
            </MapView>
            <View style={mapStyles.centerMarkerContainer}>
                <Image
                    source={require('@/assets/icons/marker.png')}
                    style={mapStyles.marker} />
            </View>
            <TouchableOpacity
                style={mapStyles.gpsButton}
                onPress={handleGpsButtonPress} >
                <MaterialCommunityIcons
                    name='crosshairs-gps'
                    size={RFValue(16)}
                    color='#3C75BE' />
            </TouchableOpacity>
            {outOfRange && (
                <View style={mapStyles.outOfRange}>
                    <FontAwesome6
                        name='road-circle-exclamation'
                        size={24}
                        color='red' />
                </View>
            )}


        </View>
    )
}

export default memo(DraggableMap)


