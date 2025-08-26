import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator } from 'react-native'
import React, { FC, memo, useEffect, useRef, useState } from 'react'
import { modalStyles } from '@/styles/modalStyles'
import { useUserStore } from '@/store/userStore'
import MapView, { Region } from 'react-native-maps'
import { getLatLong, getPlacesSuggestions, reverseGeocode } from '@/utils/mapUtils'
import LocationItem from './LocationItem'
import * as Location from 'expo-location'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { RFValue } from 'react-native-responsive-fontsize'
import { customMapStyle, indiaIntialRegion } from '@/utils/CustomMap'
import { mapStyles } from '@/styles/mapStyles'
interface MapPickerModalProps {
    visible: boolean
    onClose: () => void
    title: string
    selectedLocation: {
        latitude: number
        longitude: number
        address: string
    }
    onSelectLocation: (location: any) => void
}

const MapPickerModal: FC<MapPickerModalProps> = ({ visible, selectedLocation, onClose, title, onSelectLocation }) => {

    const mapRef = useRef<MapView>(null)
    const [text, setText] = useState('')
    const { location } = useUserStore()
    const [address, setAddress] = useState('')
    const [region, setRegion] = useState<Region | null>(null)
    const [locations, setLocations] = useState<any[]>([])
    const TextInputRef = useRef<TextInput>(null)
    const [loadingLocation, setLoadingLocation] = useState(false)
    const fetchLocation = async (query: string) => {
        if (query?.length > 4) {
            // Fetch location suggestions based on the query
            const data = await getPlacesSuggestions(query)
            setLocations(data);
        } else {
            setLocations([])
        }
    }
    useEffect(() => {
        if (selectedLocation?.latitude) {
            setAddress(selectedLocation?.address)
            setRegion({
                latitude: selectedLocation?.latitude,
                longitude: selectedLocation?.longitude,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5,
            })
            mapRef?.current?.fitToCoordinates([{
                latitude: selectedLocation?.latitude,
                longitude: selectedLocation?.longitude
            }], {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true
            })
        }
    }, [selectedLocation, mapRef])

    const addLocation = async (place_id: string) => {
        const data = await getLatLong(place_id)
        if (data) {
            setRegion({
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.5,
                longitudeDelta: 0.5,
            })
            setAddress(data.address)
        }
        TextInputRef.current?.blur()
        setText('')
    }
    const renderLocations = ({ item }: any) => {
        return (
            <LocationItem item={item} onPress={() => addLocation(item?.place_id)} />
        )
    }

    const handleRegionChangeComplete = async (region: Region) => {
        try {
            const address = await reverseGeocode(
                region?.latitude,
                region?.longitude
            )
            setRegion(region)
            setAddress(address)
        } catch (error) {
            console.error("Error fetching address: ", error)
        }
    }

    const handleGpsButtonPress = async () => {
        setLoadingLocation(true)
        try {
            const location = await Location.getCurrentPositionAsync({})
            const { latitude, longitude } = location.coords;
            mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true
            })
            const address = await reverseGeocode(latitude, longitude)
            setAddress(address)
            setRegion({
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            })
        } catch (error) {
            console.error("Error fetching GPS location: ", error)
        } finally {
            setLoadingLocation(false)
        }
    }

    return (
        <Modal
            animationType='slide'
            visible={visible}
            presentationStyle='formSheet'
            onRequestClose={onClose}>
            <View style={modalStyles?.modalContainer}>
                <Text style={modalStyles?.centerText}>Select {title}</Text>
                <TouchableOpacity onPress={onClose}>
                    <Text style={modalStyles?.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <View style={modalStyles?.searchContainer}>
                    <Ionicons name='search-outline' size={RFValue(16)} color='#777' />
                    <TextInput
                        ref={TextInputRef}
                        style={modalStyles?.input}
                        placeholder='Search for a location'
                        placeholderTextColor={'#aaa'}
                        value={text}
                        onChangeText={(text) => {
                            setText(text)
                            fetchLocation(text)
                        }}
                    />
                </View>
                {text !== '' ? (
                    <FlatList
                        ListHeaderComponent={
                            <View>{text.length > 4 ? null : (
                                <Text style={{ marginHorizontal: 16 }}>
                                    Enter at least 4 characters to see suggestions
                                </Text>
                            )}
                            </View>
                        }
                        data={locations}
                        renderItem={renderLocations}
                        keyExtractor={(item: any) => item.place_id}
                        initialNumToRender={5}
                        windowSize={5}

                    />
                ) : (
                    <>
                        <View style={{ flex: 1, width: '100%' }}>
                            <MapView
                                ref={mapRef}
                                maxZoomLevel={20}
                                minZoomLevel={12}
                                zoomEnabled={true}
                                zoomControlEnabled={true}
                                pitchEnabled={false}
                                onRegionChangeComplete={handleRegionChangeComplete}
                                style={{ flex: 1 }}
                                initialRegion={{
                                    latitude:
                                        region?.latitude ??
                                        location?.latitude ??
                                        indiaIntialRegion?.latitude,
                                    longitude:
                                        region?.longitude ??
                                        location?.longitude ??
                                        indiaIntialRegion?.longitude,
                                    latitudeDelta: 0.5,
                                    longitudeDelta: 0.5,
                                }}
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
                            />
                            <View style={mapStyles.centerMarkerContainer}>
                                <Image source={title === 'drop' ? require('@/assets/icons/drop_marker.png') : require('@/assets/icons/marker.png')} style={mapStyles.marker} />
                            </View>
                            <TouchableOpacity style={mapStyles.gpsButton} onPress={handleGpsButtonPress}>
                                <MaterialCommunityIcons name='crosshairs-gps' size={RFValue(16)} color='#3C75BE' />
                            </TouchableOpacity>
                        </View>
                        {/* <View style={modalStyles.footerContainer}>
                            <Text style={modalStyles.addressText} numberOfLines={2}>{address === " " ? "Getting address..." : address}</Text>
                            <View style={modalStyles.buttonContainer}>
                                <TouchableOpacity style={modalStyles.button}
                                    onPress={() => {
                                        onSelectLocation({
                                            type: title,
                                            latitude: region?.latitude,
                                            longitude: region?.longitude,
                                            address: address
                                        })
                                        onClose()
                                    }}>
                                    <Text style={modalStyles.buttonText}>Set  Address</Text>
                                </TouchableOpacity></View>
                        </View> */}
                        <View style={modalStyles.footerContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {loadingLocation ? <ActivityIndicator size='small' color='#000' /> : null}
                                <Text style={[modalStyles.addressText, { marginLeft: loadingLocation ? 8 : 0 }]} numberOfLines={2}>
                                    {!loadingLocation && !address?.trim() ? 'Getting address...' : (address ?? '')}
                                </Text>
                            </View>
                            <View style={modalStyles.buttonContainer}>
                                <TouchableOpacity
                                    style={[modalStyles.button, (loadingLocation || !region || !address?.trim()) ? { opacity: 0.5 } : null]}
                                    disabled={loadingLocation || !region || !address?.trim()}
                                    onPress={() => {
                                        if (loadingLocation || !region || !address?.trim()) return
                                        onSelectLocation({
                                            type: title,
                                            latitude: region?.latitude,
                                            longitude: region?.longitude,
                                        })
                                        onClose()
                                    }}>
                                    <Text style={modalStyles.buttonText}>Set Address</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                )}
            </View>

        </Modal>
    )
}

export default memo(MapPickerModal)