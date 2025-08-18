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

const Auth = () => {
  const { updateAccessToken } = UseWS();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchWithTimeout = (url: string, options: RequestInit, timeout = 30000): Promise<Response> => {
    return Promise.race([
      fetch(url, options),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('fetch-timeout')), timeout)
      )
    ]) as Promise<Response>;
  };
  const handleSignIn = async () => {
    console.log('Phone value being sent:', phone);
    if (!phone) {
      Alert.alert('Invalid', 'Phone is empty');
      return;
    }

    const signUrl = `${BASE_URL}/auth/signin`;
    console.log('Sign-in URL:', signUrl);
    setIsLoading(true);

    try {
      // quick reachability ping to the base ngrok host (short timeout)
      try {
        const pingUrl = signUrl.replace(/\/auth\/signin$/, '/'); // hits root of tunnel
        console.log('Pinging tunnel:', pingUrl);
        const ping = await fetchWithTimeout(pingUrl, { method: 'GET' }, 5000);
        console.log('Ping response status:', ping.status);
      } catch (pingErr) {
        console.warn('Tunnel ping failed:', pingErr);
        throw new Error('Cannot reach backend tunnel from device. Check ngrok / network.');
      }

      console.log('Starting sign-in request...');
      const response = await fetchWithTimeout(signUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ phone, role: 'customer' }),
      }, 30000);

      console.log('Fetch resolved:', response);
      console.log('Response ok:', response.ok, 'status:', response.status);
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : await response.text();
      console.log('Parsed backend response:', data);

      if (response.ok && data && (data as any).token) {
        updateAccessToken((data as any).token);
        router.push('/customer/home');
        return;
      }

      Alert.alert('Sign-in failed', typeof data === 'string' ? data : ((data as any).message || 'Unknown error'));

    } catch (err: any) {
      console.error('Sign-in fetch error:', err);
      Alert.alert('Sign-in error', err.message || String(err));
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
      <View>
        <Button
          title='NEXT'
          onPress={() => router.navigate('/customer/home')}
        />
      </View>

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