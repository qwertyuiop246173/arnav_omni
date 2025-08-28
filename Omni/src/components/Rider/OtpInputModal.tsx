import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert } from 'react-native'
import React, { FC, memo, useEffect, useRef, useState } from 'react'
import { modalStyles } from '@/styles/modalStyles'

interface OtpInputModalProps {
  visible: boolean
  onClose: () => void
  title: string
  onConfirm: (otp: string) => void
  expectedOtp?: string
}

const OtpInputModal: FC<OtpInputModalProps> = ({ visible, onClose, title, onConfirm, expectedOtp }) => {

  const [otp, setOtp] = useState(["", "", "", ""])
  const inputs = useRef<Array<any>>([])
  const submittedRef = useRef(false)
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

  // reset helper
  const resetOtp = () => {
    setOtp(["", "", "", ""])
    submittedRef.current = false
    try { inputs.current[0] && inputs.current[0].focus() } catch (e) { /* ignore */ }
  }

  // reset submitted state when modal becomes visible
  useEffect(() => {
    if (visible) {
      submittedRef.current = false
      resetOtp()
    }
  }, [visible])

  // auto-confirm when expectedOtp matches entered OTP
  useEffect(() => {
    const joined = otp.join('')
    if (joined.length !== 4) return
    if (submittedRef.current) return

    // mark submitted to avoid duplicate calls
    submittedRef.current = true

    if (typeof expectedOtp === 'string' && expectedOtp.length === 4) {
      if (joined === expectedOtp) {
        try { onConfirm(joined) } catch (e) { console.warn('[OtpInputModal] onConfirm failed', e) }
        resetOtp()
      } else {
        Alert.alert('Invalid OTP', 'The entered OTP is incorrect.')
        // allow retry
        submittedRef.current = false
        resetOtp()
      }
    } else {
      // no expected provided: treat auto-fill as confirm action
      try { onConfirm(joined) } catch (e) { console.warn('[OtpInputModal] onConfirm failed', e) }
      resetOtp()
    }
  }, [otp, expectedOtp, onConfirm])

  const handleConfirm = () => {
    const otpValue = otp.join("")
    if (otpValue.length === 4 && !submittedRef.current) {
      submittedRef.current = true
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
              ref={(ref) => { inputs.current[index] = ref }}
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