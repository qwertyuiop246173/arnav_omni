import { View, Text, SafeAreaView, ScrollView, Image, TouchableOpacity, Alert, Button } from 'react-native'
import React, { useState } from 'react'
import { authStyles } from '@/styles/authStyles'
import { commonStyles } from '@/styles/commonStyles'
import CustomText from '@/components/shared/customText'
import CustomButton from '@/components/shared/customButton'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { UseWS } from '@/service/WSProvider'
import PhoneInput from '@/components/shared/PhoneInput'
import { Signin } from '@/service/authService'
import { router } from 'expo-router'

const auth = () => {

  const { updateAccessToken } = UseWS()
  const [phone, setPhone] = useState("")
  // const handleNext = async () => {
  //   if (!phone || phone.length !== 10) {
  //     Alert.alert("Please enter a valid phone number");
  //     return;
  //   }
  //   Signin({ role: 'rider', phone }, updateAccessToken);
  // }

  const [isLoading, setIsLoading] = useState(false);

  const handleNext = async () => {
    if (!phone || phone.length !== 10) {
      Alert.alert("Invalid Input", "Please enter a valid 10-digit phone number");
      return;
    }
    try {
      setIsLoading(true);
      const success = await Signin({
        role: 'rider',
        phone
      }, updateAccessToken);

      if (success) {
        router.push('/rider/home');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      Alert.alert(
        "Authentication Failed",
        error?.message || "Failed to sign in. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <SafeAreaView style={authStyles.container}>
      <ScrollView contentContainerStyle={authStyles.container}>
        <View style={commonStyles.flexRowBetween}>
          <Image source={require('@/assets/images/rider_logo.png')} style={authStyles.logo} />
          <TouchableOpacity style={authStyles.flexRowGap}>
            <MaterialIcons name='help' size={18} color='grey' />
            <CustomText fontFamily='Medium' variant='h7'>Help</CustomText>
          </TouchableOpacity>
        </View>
        <CustomText fontFamily='Medium' variant='h6'>
          Good to see you, Rider!
        </CustomText>
        <CustomText fontFamily='Regular' variant='h7'>
          Enter your phone number to continue
        </CustomText>
        <PhoneInput
          value={phone}
          onChangeText={setPhone}
        />

      </ScrollView>
      <View style={authStyles.footerContainer}>
        <CustomText fontFamily='Regular' variant='h8' style={[commonStyles.lightText, { textAlign: 'center', marginHorizontal: 20 }]}>By continuing, you agree to our Terms of Service and Privacy Policy.</CustomText>
        <CustomButton
          title='Next'
          onPress={handleNext}
          loading={false}
          disabled={false}
        />
      </View>
    </SafeAreaView>
  )
}

export default auth