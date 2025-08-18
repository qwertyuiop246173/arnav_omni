import { View, Text, Image, TouchableOpacity } from 'react-native'
import React, { FC, memo, useEffect, useRef, useState } from 'react'
import MapView, { Marker, Polyline } from 'react-native-maps'
import { customMapStyle, indiaIntialRegion } from '@/utils/CustomMap'
import MapViewDirections from 'react-native-maps-directions'
import { Colors } from '@/utils/Constants'
import { getPoints } from '@/utils/mapUtils'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { RFValue } from 'react-native-responsive-fontsize'
import { mapStyles } from '@/styles/mapStyles'
const apikey = process.env.EXPO_PUBLIC_MAP_API_KEY || ' '
const LiveTrackingMap: FC<{
    height: number
    drop: any,
    pickup: any
    rider: any
    status: string
}> = ({ drop, status, height, pickup, rider }) => {

    const mapRef = useRef<MapView>(null);
    const [isUserInteracting, setIsUserInteracting] = useState(false);
    const fitToMarkers = async () => {
        if (isUserInteracting) return;
        const coordinates = []
        if (pickup?.latitude && pickup?.longitude && status === 'START') {
            coordinates.push({
                latitude: pickup.latitude,
                longitude: pickup.longitude
            })
        }
        if (drop?.latitude && drop?.longitude && status === 'ARRIVED') {
            coordinates.push({
                latitude: drop.latitude,
                longitude: drop.longitude
            })
        }
        if (rider?.latitude && rider?.longitude) {
            coordinates.push({
                latitude: rider.latitude,
                longitude: rider.longitude
            })
        }
        if (coordinates.length === 0) return;

        try {
            mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true
            });
        } catch (error) {
            console.error("Error fitting map to coordinates:", error);
        }
    }

    const calculateInitialRegion = () => {
        if (pickup?.latitude && drop?.latitude) {
            const latitude = (pickup.latitude + drop.latitude) / 2;
            const longitude = (pickup.longitude + drop.longitude) / 2;
            return {
                latitude,
                longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            };
        }
        return indiaIntialRegion;
    }
    useEffect(() => {
        if (pickup?.latitude && drop?.latitude) fitToMarkers();
    }, [drop?.latitude, pickup?.latitude, rider?.latitude])
    return (
        <View style={{ height: height, width: '100%' }}>
            <MapView
                ref={mapRef}
                followsUserLocation
                style={{ flex: 1 }}
                initialRegion={calculateInitialRegion()}
                provider='google'
                showsMyLocationButton={false}
                showsCompass={false}
                showsIndoors={false}
                customMapStyle={customMapStyle}
                showsUserLocation={true}
                onRegionChange={() => setIsUserInteracting(true)}
                onRegionChangeComplete={() => setIsUserInteracting(false)}
            >
                {rider?.latitude && pickup?.latitude && (
                    <MapViewDirections
                        origin={rider}
                        destination={status === 'START' ? pickup : drop}
                        onReady={fitToMarkers}
                        apikey={apikey}
                        strokeWidth={5}
                        strokeColor={Colors.iosColor}
                        strokeColors={[Colors.iosColor]}
                        precision='high'
                        onError={(error) => console.error("MapViewDirections error:", error)}
                    />
                )}
                {drop?.latitude && (
                    <Marker
                        coordinate={{
                            latitude: drop.latitude,
                            longitude: drop.longitude
                        }}
                        anchor={{ x: 0.5, y: 1 }}
                        zIndex={1}
                    >
                        <Image
                            source={require('@/assets/icons/drop_marker.png')}
                            style={{ width: 30, height: 30, resizeMode: 'contain' }}
                        />
                    </Marker>
                )}

                {pickup?.latitude && (
                    <Marker
                        coordinate={{
                            latitude: pickup.latitude,
                            longitude: pickup.longitude
                        }}
                        anchor={{ x: 0.5, y: 1 }}
                        zIndex={2}
                    >
                        <Image
                            source={require('@/assets/icons/marker.png')}
                            style={{ width: 30, height: 30, resizeMode: 'contain' }}
                        />
                    </Marker>
                )}
                {rider?.latitude && (
                    <Marker
                        coordinate={{
                            latitude: rider.latitude,
                            longitude: rider.longitude
                        }}
                        anchor={{ x: 0.5, y: 1 }}
                        zIndex={3}
                    >
                        <View style={{ transform: [{ rotate: `${rider?.heading}deg` }] }}>
                            <Image
                                source={require('@/assets/icons/cab_marker.png')}
                                style={{ width: 40, height: 40, resizeMode: 'contain' }}
                            />
                        </View>

                    </Marker>
                )}
                {drop && pickup && (
                    <Polyline
                        coordinates={getPoints([drop, pickup])}
                        strokeColor={Colors.text}
                        strokeWidth={2}
                        geodesic={true}
                        lineDashPattern={[12, 10]}
                    />
                )}
            </MapView>
            <TouchableOpacity style={mapStyles.gpsButton} onPress={fitToMarkers}>
                <MaterialCommunityIcons
                    name="crosshairs-gps"
                    size={RFValue(16)}
                    color='#3C75BE' />
            </TouchableOpacity>
        </View >
    )
}

export default memo(LiveTrackingMap)