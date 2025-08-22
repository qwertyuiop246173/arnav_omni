// import { Platform } from 'react-native';
// const DEV_ANDROID_URL = 'http://10.0.2.2:21651/api';  // For Android Emulator
// const DEV_IOS_URL = 'http://localhost:21651/api';      // For iOS Simulator
// const PROD_URL = 'https://your-production-url.com/api'; // For Production

// export const BASE_URL = __DEV__
//     ? Platform.OS === 'android'
//         ? DEV_ANDROID_URL
//         : DEV_IOS_URL
//     : PROD_URL;

// export const SOCKET_URL = BASE_URL.replace('/api', '');
import { Platform } from 'react-native';

// Replace with your computer's local IP address
const LOCAL_IP = '45.118.48.2'; // <-- Change this to your actual IP

//const DEV_ANDROID_URL = `http://${LOCAL_IP}:21651/api`;  // nFor Android Device
// const DEV_ANDROID_URL = ` https://7c5b32811e55.ngrok-free.app`
// const DEV_IOS_URL = `http://${LOCAL_IP}:21651/api`;      // For iOS Device/Simulator
// const PROD_URL = 'https://your-production-url.com/api';  // For Production

export const BASE_URL = 'https://b36d15c4f997.ngrok-free.app/api';

export const SOCKET_URL = BASE_URL.replace('/api', '');