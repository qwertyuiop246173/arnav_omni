const crypto = require('crypto');

function generateKey() {
    return crypto.randomBytes(32).toString('hex');
}

console.log('MMKV Storage Encryption Keys:\n');
console.log(`MMKV_TOKEN_KEY_IOS=${generateKey()}`);
console.log(`MMKV_TOKEN_KEY_ANDROID=${generateKey()}`);
console.log(`MMKV_APP_KEY_IOS=${generateKey()}`);
console.log(`MMKV_APP_KEY_ANDROID=${generateKey()}`);