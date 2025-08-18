import { MMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

// Use platform-specific encryption keys
const TOKEN_KEY = Platform.select({
    ios: 'ios_secure_token_key_2024',
    android: 'android_secure_token_key_2024',
    default: 'default_token_key_2024'
});

export const tokenStorage = new MMKV({
    id: 'token-storage',
    encryptionKey: TOKEN_KEY
});

export const storage = new MMKV({
    id: 'app-storage',
    encryptionKey: TOKEN_KEY
});

export const mmkvStorage = {
    setItem: (key: string, value: string) => {
        try {
            storage.set(key, value);
            return true;
        } catch (error) {
            console.error('Storage setItem error:', error);
            return false;
        }
    },
    getItem: (key: string) => {
        try {
            const value = storage.getString(key);
            return value ?? null;
        } catch (error) {
            console.error('Storage getItem error:', error);
            return null;
        }
    },
    removeItem: (key: string) => {
        try {
            storage.delete(key);
            return true;
        } catch (error) {
            console.error('Storage removeItem error:', error);
            return false;
        }
    },
};