// import { View, Text, Image, TouchableOpacity } from 'react-native'
// import React, { FC, memo, useEffect, useRef, useState } from 'react'
// import MapView, { Marker, Polyline } from 'react-native-maps'
// import { customMapStyle, indiaIntialRegion } from '@/utils/CustomMap'
// import MapViewDirections from 'react-native-maps-directions'
// import { Colors } from '@/utils/Constants'
// import { getPoints } from '@/utils/mapUtils'
// import { MaterialCommunityIcons } from '@expo/vector-icons'
// import { RFValue } from 'react-native-responsive-fontsize'
// import { mapStyles } from '@/styles/mapStyles'
// const apikey = process.env.EXPO_PUBLIC_MAP_API_KEY || ' '
// const LiveTrackingMap: FC<{
//     height: number
//     drop: any,
//     pickup: any
//     rider: any
//     status: string
// }> = ({ drop, status, height, pickup, rider }) => {

//     const mapRef = useRef<MapView>(null);
//     const [isUserInteracting, setIsUserInteracting] = useState(false);
//     const fitToMarkers = async () => {
//         if (isUserInteracting) return;
//         const coordinates = []
//         if (pickup?.latitude && pickup?.longitude && status === 'START') {
//             coordinates.push({
//                 latitude: pickup.latitude,
//                 longitude: pickup.longitude
//             })
//         }
//         if (drop?.latitude && drop?.longitude && status === 'ARRIVED') {
//             coordinates.push({
//                 latitude: drop.latitude,
//                 longitude: drop.longitude
//             })
//         }
//         if (rider?.latitude && rider?.longitude) {
//             coordinates.push({
//                 latitude: rider.latitude,
//                 longitude: rider.longitude
//             })
//         }
//         if (coordinates.length === 0) return;

//         try {
//             mapRef.current?.fitToCoordinates(coordinates, {
//                 edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
//                 animated: true
//             });
//         } catch (error) {
//             console.error("Error fitting map to coordinates:", error);
//         }
//     }

//     const calculateInitialRegion = () => {
//         if (pickup?.latitude && drop?.latitude) {
//             const latitude = (pickup.latitude + drop.latitude) / 2;
//             const longitude = (pickup.longitude + drop.longitude) / 2;
//             return {
//                 latitude,
//                 longitude,
//                 latitudeDelta: 0.05,
//                 longitudeDelta: 0.05,
//             };
//         }
//         return indiaIntialRegion;
//     }
//     useEffect(() => {
//         if (pickup?.latitude && drop?.latitude) fitToMarkers();
//     }, [drop?.latitude, pickup?.latitude, rider?.latitude])
//     return (
//         <View style={{ height: height, width: '100%' }}>
//             <MapView
//                 ref={mapRef}
//                 followsUserLocation
//                 style={{ flex: 1 }}
//                 initialRegion={calculateInitialRegion()}
//                 provider='google'
//                 showsMyLocationButton={false}
//                 showsCompass={false}
//                 showsIndoors={false}
//                 customMapStyle={customMapStyle}
//                 showsUserLocation={true}
//                 onRegionChange={() => setIsUserInteracting(true)}
//                 onRegionChangeComplete={() => setIsUserInteracting(false)}
//             >
//                 {rider?.latitude && pickup?.latitude && (
//                     <MapViewDirections
//                         origin={rider}
//                         destination={status === 'START' ? pickup : drop}
//                         onReady={fitToMarkers}
//                         apikey={apikey}
//                         strokeWidth={5}
//                         strokeColor={Colors.iosColor}
//                         strokeColors={[Colors.iosColor]}
//                         precision='high'
//                         onError={(error) => console.error("MapViewDirections error:", error)}
//                     />
//                 )}
//                 {drop?.latitude && (
//                     <Marker
//                         coordinate={{
//                             latitude: drop.latitude,
//                             longitude: drop.longitude
//                         }}
//                         anchor={{ x: 0.5, y: 1 }}
//                         zIndex={1}
//                     >
//                         <Image
//                             source={require('@/assets/icons/drop_marker.png')}
//                             style={{ width: 30, height: 30, resizeMode: 'contain' }}
//                         />
//                     </Marker>
//                 )}

//                 {pickup?.latitude && (
//                     <Marker
//                         coordinate={{
//                             latitude: pickup.latitude,
//                             longitude: pickup.longitude
//                         }}
//                         anchor={{ x: 0.5, y: 1 }}
//                         zIndex={2}
//                     >
//                         <Image
//                             source={require('@/assets/icons/marker.png')}
//                             style={{ width: 30, height: 30, resizeMode: 'contain' }}
//                         />
//                     </Marker>
//                 )}
//                 {rider?.latitude && (
//                     <Marker
//                         coordinate={{
//                             latitude: rider.latitude,
//                             longitude: rider.longitude
//                         }}
//                         anchor={{ x: 0.5, y: 1 }}
//                         zIndex={3}
//                     >
//                         <View style={{ transform: [{ rotate: `${rider?.heading}deg` }] }}>
//                             <Image
//                                 source={require('@/assets/icons/cab_marker.png')}
//                                 style={{ width: 40, height: 40, resizeMode: 'contain' }}
//                             />
//                         </View>

//                     </Marker>
//                 )}
//                 {drop && pickup && (
//                     <Polyline
//                         coordinates={getPoints([drop, pickup])}
//                         strokeColor={Colors.text}
//                         strokeWidth={2}
//                         geodesic={true}
//                         lineDashPattern={[12, 10]}
//                     />
//                 )}
//             </MapView>
//             <TouchableOpacity style={mapStyles.gpsButton} onPress={fitToMarkers}>
//                 <MaterialCommunityIcons
//                     name="crosshairs-gps"
//                     size={RFValue(16)}
//                     color='#3C75BE' />
//             </TouchableOpacity>
//         </View >
//     )
// }

// export default memo(LiveTrackingMap)
import { View, Image, TouchableOpacity } from 'react-native'
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

    const parseCoord = (v: any) => {
        if (v === null || v === undefined) return 0
        const n = typeof v === 'number' ? v : parseFloat(String(v))
        return Number.isFinite(n) ? n : 0
    }

    const riderLat = parseCoord(rider?.latitude)
    const riderLng = parseCoord(rider?.longitude)
    const pickupLat = parseCoord(pickup?.latitude)
    const pickupLng = parseCoord(pickup?.longitude)
    const dropLat = parseCoord(drop?.latitude)
    const dropLng = parseCoord(drop?.longitude)

    const fitToMarkers = async () => {
        if (isUserInteracting) return;
        const coordinates: { latitude: number; longitude: number }[] = []

        // include rider, pickup, drop if coordinates present
        if (Number.isFinite(riderLat) && Number.isFinite(riderLng) && (riderLat !== 0 || riderLng !== 0)) {
            coordinates.push({ latitude: riderLat, longitude: riderLng })
        }
        if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng) && (pickupLat !== 0 || pickupLng !== 0)) {
            coordinates.push({ latitude: pickupLat, longitude: pickupLng })
        }
        if (Number.isFinite(dropLat) && Number.isFinite(dropLng) && (dropLat !== 0 || dropLng !== 0)) {
            coordinates.push({ latitude: dropLat, longitude: dropLng })
        }

        if (coordinates.length === 0) return;

        try {
            mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 80, right: 80, bottom: 120, left: 80 },
                animated: true
            });
        } catch (error) {
            console.error("Error fitting map to coordinates:", error);
        }
    }

    const calculateInitialRegion = () => {
        // center between available points
        const latitudes = [riderLat, pickupLat, dropLat].filter(v => v !== 0)
        const longitudes = [riderLng, pickupLng, dropLng].filter(v => v !== 0)
        if (latitudes.length && longitudes.length) {
            const latitude = latitudes.reduce((a, b) => a + b, 0) / latitudes.length
            const longitude = longitudes.reduce((a, b) => a + b, 0) / longitudes.length
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
        fitToMarkers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [riderLat, riderLng, pickupLat, pickupLng, dropLat, dropLng])

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
                {/* Rider -> Pickup route (draw if both rider and pickup exist) */}
                {(Number.isFinite(riderLat) && Number.isFinite(riderLng)
                    && Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
                    && (riderLat !== 0 || riderLng !== 0)
                    && (pickupLat !== 0 || pickupLng !== 0)) && (
                        <MapViewDirections
                            origin={{ latitude: riderLat, longitude: riderLng }}
                            destination={{ latitude: pickupLat, longitude: pickupLng }}
                            apikey={apikey}
                            strokeWidth={5}
                            strokeColor={Colors.iosColor}
                            onReady={() => { try { fitToMarkers() } catch (e) { } }}
                            onError={(e) => console.error('MapViewDirections rider->pickup error', e)}
                        />
                    )}

                {/* Pickup -> Drop route (draw if both pickup and drop exist) */}
                {(Number.isFinite(pickupLat) && Number.isFinite(pickupLng)
                    && Number.isFinite(dropLat) && Number.isFinite(dropLng)
                    && (pickupLat !== 0 || pickupLng !== 0)
                    && (dropLat !== 0 || dropLng !== 0)) && (
                        <MapViewDirections
                            origin={{ latitude: pickupLat, longitude: pickupLng }}
                            destination={{ latitude: dropLat, longitude: dropLng }}
                            apikey={apikey}
                            strokeWidth={4}
                            strokeColor={'#22C55E'}
                            onReady={() => { try { fitToMarkers() } catch (e) { } }}
                            onError={(e) => console.error('MapViewDirections pickup->drop error', e)}
                        />
                    )}

                {/* Markers */}
                {dropLat !== 0 && (
                    <Marker
                        coordinate={{ latitude: dropLat, longitude: dropLng }}
                        anchor={{ x: 0.5, y: 1 }}
                        zIndex={1}
                    >
                        <Image
                            source={require('@/assets/icons/drop_marker.png')}
                            style={{ width: 30, height: 30, resizeMode: 'contain' }}
                        />
                    </Marker>
                )}

                {pickupLat !== 0 && (
                    <Marker
                        coordinate={{ latitude: pickupLat, longitude: pickupLng }}
                        anchor={{ x: 0.5, y: 1 }}
                        zIndex={2}
                    >
                        <Image
                            source={require('@/assets/icons/marker.png')}
                            style={{ width: 30, height: 30, resizeMode: 'contain' }}
                        />
                    </Marker>
                )}

                {riderLat !== 0 && (
                    <Marker
                        coordinate={{ latitude: riderLat, longitude: riderLng }}
                        anchor={{ x: 0.5, y: 1 }}
                        zIndex={3}
                    >
                        <View style={{ transform: [{ rotate: `${rider?.heading ?? 0}deg` }] }}>
                            <Image
                                source={require('@/assets/icons/cab_marker.png')}
                                style={{ width: 40, height: 40, resizeMode: 'contain' }}
                            />
                        </View>
                    </Marker>
                )}

                {/* fallback visual polyline between pickup and drop (thin dashed) */}
                {pickup && drop && (
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