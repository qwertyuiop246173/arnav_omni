import { tokenStorage } from "../store/storage";
import { router } from 'expo-router';

export const clearAuthAndLogout = () => {
    tokenStorage.clearAll();
    router.replace('/role');
};