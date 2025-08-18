import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import React, { FC } from 'react'
import CustomText from '../shared/customText'
import { CountdownCircleTimer } from 'react-native-countdown-circle-timer'
import { Colors } from '@/utils/Constants'



interface CounterButtonProps {
    title: string
    onPress: () => void
    initialCount: number
    onCountdownEnd: () => void
}
const CounterButton: FC<CounterButtonProps> = ({ title, onPress, initialCount, onCountdownEnd }) => {
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}>
            <CustomText
                fontFamily='Medium'
                fontSize={12}
                style={styles.text}
            >
                {title}
            </CustomText>
            <View style={styles.counter}>
                <CountdownCircleTimer
                    onComplete={onCountdownEnd}
                    isPlaying
                    duration={initialCount}
                    size={30}
                    strokeWidth={3}
                    colors={['#004777', '#F7B801', "#A30000", '#A30000']}
                    colorsTime={[12, 5, 2, 0]}
                >
                    {({ remainingTime }) => (
                        <CustomText fontSize={10} fontFamily='SemiBold'>{remainingTime}</CustomText>
                    )}
                </CountdownCircleTimer>

            </View>
        </TouchableOpacity>
    )
}

export const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: "center",
        padding: 10,
        borderRadius: 10,
        backgroundColor: Colors.primary
    },
    counter: {
        backgroundColor: 'white',
        borderRadius: 50
    },
    text: {
        color: '#000',
        marginRight: 10,
    }
})

export default CounterButton