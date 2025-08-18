import { View, Text, StyleSheet, TextInput } from 'react-native'
import { RFValue } from 'react-native-responsive-fontsize'
import CustomText from './customText'
import { FC } from 'react'
import { PhoneInputProps } from '@/utils/types'


const PhoneInput:FC<PhoneInputProps> = ({
    value,
    onChangeText,
    onFocus,
    onBlur
}) => {
    return (
        <View style={styles.container}>
            <CustomText fontFamily='Medium' style={styles.text}> 🇮🇳 +91</CustomText>
            <TextInput
                style={styles.input}
                placeholder='Enter your phone number'
                keyboardType='phone-pad'
                value={value}
                maxLength={10}
                onChangeText={onChangeText}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholderTextColor={'#ccc'}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginVertical: 15,
        borderWidth: 1,
        borderColor: '#222',
        borderRadius: 0,
        paddingHorizontal: 10
    },
    input: {
        fontSize: RFValue(13),
        fontFamily: 'Medium',
        height: 45,
        width: '90%'
    },
    text: {
        fontSize: RFValue(13),
        top: -1,
        fontFamily: 'Medium'
    }

})
export default PhoneInput