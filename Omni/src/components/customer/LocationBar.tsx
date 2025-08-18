import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native'
import React from 'react'
import { useUserStore } from '@/store/userStore'
import { UseWS } from '@/service/WSProvider'
import { uiStyles } from '@/styles/uiStyles'
import { logout } from '@/service/authService'
import { RFValue } from 'react-native-responsive-fontsize'
import { Colors } from '@/utils/Constants'
import CustomText from '../shared/customText'
import AntDesign from '@expo/vector-icons/AntDesign'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { router } from 'expo-router'

const LocationBar = () => {
    const { location } = useUserStore()
    const { disconnect } = UseWS()
    type RootStackParamList = {
        SetLocation: undefined;
    };

    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    return (
        <View style={uiStyles.absoluteTop}>
            <SafeAreaView />
            <View style={uiStyles.container}>
                <TouchableOpacity
                    onPress={() => logout(disconnect)} style={uiStyles.btn}>
                    <AntDesign name='poweroff' size={RFValue(18)} color={Colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => router.push('/customer/setlocation')}
                    style={uiStyles.locationBar}>
                    <View style={uiStyles.dot} />
                    <CustomText numberOfLines={1} style={uiStyles.locationText}>
                        {location?.address || "Getting addreess..."}
                    </CustomText>
                </TouchableOpacity>
            </View>
        </View>
    )
}

export default LocationBar