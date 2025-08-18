import { View, Text, StyleSheet, TextInput, TextInputProps, TouchableOpacity } from 'react-native'
import React, { FC } from 'react'
import { Ionicons } from '@expo/vector-icons';

interface LocationInputProps extends TextInputProps {
    placeholder: string;
    type: 'pickup' | 'drop';
    value: string
    onChangeText: (text: string) => void
}
const LocationInput: FC<LocationInputProps> = ({ placeholder, type, value, onChangeText, ...props }) => {
    const dotColor = type === 'pickup' ? 'green' : 'red';

    return (
        <View style={[styles.container, styles.focusedContainer, { backgroundColor: value == '' ? '#fff' : '#f2f2f2' }]}>
            <View style={[styles.dot,{backgroundColor:dotColor}]}/>
                <TextInput
                style={[styles.input,{ backgroundColor: value == '' ? '#fff' : '#f2f2f2' }]}
                    placeholder={placeholder}
                    placeholderTextColor={"#aaa"}
                    value={value}
                    onChangeText={onChangeText}
                    
                    {...props}
                />
                {value !== '' && (
                    <TouchableOpacity onPress={() => onChangeText('')}>
                        <Ionicons name="close-circle" size={20} color="#ccc" />
                    </TouchableOpacity>
                )}
            
        </View>
    )
}
const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        borderRadius: 8,
        marginVertical: 7
    },
    focusedContainer: {
        borderColor: '#ccc',
        borderWidth: 1
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 4,
        marginRight: 10
    },
    input: {
        height: 45,
        width: '90%',
        fontSize: 16,
        color: '#000'
    }
})

export default LocationInput