// import { View, Text, SafeAreaView, ScrollView, Image, TouchableOpacity, Alert, Button } from 'react-native'
// import React, { useState } from 'react'
// import { authStyles } from '@/styles/authStyles';
// import { commonStyles } from '../../styles/commonStyles'
// import CustomText from '../../components/shared/customText'
// import CustomButton from '@/components/shared/customButton';
// import { Ionicons } from '@expo/vector-icons';
// import { UseWS } from '@/service/WSProvider';
// import { Signin } from '@/service/authService';
// import PhoneInput from '@/components/shared/PhoneInput';
// import { router } from 'expo-router'

// const Auth = () => {
//   const { updateAccessToken } = UseWS();
//   const [phone, setPhone] = useState("");
//   const [isLoading, setIsLoading] = useState(false);

//   const handleNext = async () => {
//     if (!phone || phone.length !== 10) {
//       Alert.alert("Invalid Input", "Please enter a valid 10-digit phone number");
//       return;
//     }
//     try {
//       setIsLoading(true);
//       const success = await Signin({
//         role: 'customer',
//         phone
//       }, updateAccessToken);

//       if (success) {
//         router.push('/customer/home');
//       }
//     } catch (error: any) {
//       console.error('Authentication error:', error);
//       Alert.alert(
//         "Authentication Failed",
//         error?.message || "Failed to sign in. Please try again."
//       );
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <SafeAreaView style={authStyles.container}>
//       <ScrollView contentContainerStyle={authStyles.container}>
//         <View style={commonStyles.flexRowBetween}>
//           <Image source={require('@/assets/images/logo_t.png')} style={authStyles.logo} />
//           <TouchableOpacity style={authStyles.flexRowGap}>
//             <Ionicons name="help-circle-outline" size={18} color="grey" />
//             <CustomText fontFamily='Medium' variant='h7'>Help</CustomText>
//           </TouchableOpacity>
//         </View>

//         <CustomText fontFamily='Medium' variant='h6'>
//           What's your number?
//         </CustomText>
//         <CustomText fontFamily='Regular' variant='h7'>
//           Enter your phone number to continue
//         </CustomText>
//         <PhoneInput
//           value={phone}
//           onChangeText={setPhone}
//         />


//       </ScrollView>

//       <View style={authStyles.footerContainer}>

//         <CustomText fontFamily='Regular' variant='h8' style={[commonStyles.lightText, { textAlign: 'center', marginHorizontal: 20 }]}>By continuing, you agree to our Terms of Service and Privacy Policy.</CustomText>
//         <CustomButton
//           title='Next'
//           onPress={handleNext}
//           loading={isLoading}
//           disabled={isLoading}
//         />
//       </View>
//     </SafeAreaView>
//   )
// };

// export default Auth;

import { View, Text, SafeAreaView, ScrollView, Image, TouchableOpacity, Alert, Button } from 'react-native'
import React, { useState } from 'react'
import { authStyles } from '@/styles/authStyles';
import { commonStyles } from '../../styles/commonStyles'
import CustomText from '../../components/shared/customText'
import CustomButton from '@/components/shared/customButton';
import { Ionicons } from '@expo/vector-icons';
import { UseWS } from '@/service/WSProvider';
import PhoneInput from '@/components/shared/PhoneInput';
import { router } from 'expo-router'
import { BASE_URL } from '@/service/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Auth = () => {
  const { updateAccessToken } = UseWS();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);



  const handleSignIn = async () => {
    if (!phone || phone.length !== 10) {
      Alert.alert("Invalid", "Enter a valid 10-digit phone number");
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, role: 'customer' })
      });

      const data = await response.json();
      if (response.ok && data?.token) {
        await AsyncStorage.setItem('token', data.token);   // persist
        updateAccessToken(data.token);                     // for sockets
        router.replace('/customer/home');                  // go to home
      } else {
        Alert.alert("Login failed", data?.message || "Unknown error");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };




  return (
    <SafeAreaView style={authStyles.container}>
      <ScrollView contentContainerStyle={authStyles.container}>
        <View style={commonStyles.flexRowBetween}>
          <Image source={require('@/assets/images/logo_t.png')} style={authStyles.logo} />
          <TouchableOpacity style={authStyles.flexRowGap}>
            <Ionicons name="help-circle-outline" size={18} color="grey" />
            <CustomText fontFamily='Medium' variant='h7'>Help</CustomText>
          </TouchableOpacity>
        </View>

        <CustomText fontFamily='Medium' variant='h6'>
          What's your number?
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
        <CustomText fontFamily='Regular' variant='h8' style={[commonStyles.lightText, { textAlign: 'center', marginHorizontal: 20 }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </CustomText>
        <CustomButton
          title='Next'
          onPress={handleSignIn}
          loading={isLoading}
          disabled={isLoading}
        />
      </View>
    </SafeAreaView>
  )
};

export default Auth;