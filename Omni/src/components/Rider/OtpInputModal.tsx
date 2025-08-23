import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity } from 'react-native'
import React, { FC, memo, useRef, useState } from 'react'
import { modalStyles } from '@/styles/modalStyles'

interface OtpInputModalProps {
  visible: boolean
  onClose: () => void
  title: string
  onConfirm: (otp: string) => void
}

const OtpInputModal: FC<OtpInputModalProps> = ({ visible, onClose, title, onConfirm }) => {

  const [otp, setOtp] = useState(["", "", "", ""])
  const inputs = useRef<Array<any>>([])
  const handleOtpChange = (value: string, index: number) => {
    if (/^\d$/.test(value) || value === "") {
      const newOtp = [...otp]
      newOtp[index] = value
      setOtp(newOtp)

      if (value && index < inputs.current.length - 1) {
        inputs.current[index + 1].focus()
      }

      if (!value && index > 0) {
        inputs.current[index - 1].focus()
      }
    }
  }

  const handleConfirm = () => {
    const otpValue = otp.join("")
    if (otpValue.length === 4) {
      onConfirm(otpValue)
    } else {
      alert("Please enter a valid OTP")
    }
  }

  return (
    <Modal
      animationType="slide"
      visible={visible}
      presentationStyle='formSheet'
      onRequestClose={onClose}>
      <View style={modalStyles.modalContainer}>
        <Text style={modalStyles.centerText}>{title}</Text>
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {inputs.current[index] = ref}}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              style={styles.otpInput}
              keyboardType="numeric"
              maxLength={1}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    margin: 20
  },
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: '#d3d3d3',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18
  },
  confirmButton: {
    backgroundColor: '#007bff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    margin: 20
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
})

export default memo(OtpInputModal)