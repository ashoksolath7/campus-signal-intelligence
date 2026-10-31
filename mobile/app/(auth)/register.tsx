import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { sendOtpApi, verifyOtpApi } from "../../src/services/auth";
import { Button } from "../../src/components/ui/Button";
import { TextInput } from "../../src/components/ui/TextInput";
import { Alert } from "../../src/components/ui/Alert";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { Colors } from "../../src/theme/colors";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP flow state
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  function handleEmailChange(text: string) {
    setEmail(text);
    if (isVerified && text.trim().toLowerCase() !== verifiedEmail.toLowerCase()) {
      setIsVerified(false);
      setVerifiedEmail("");
      setVerificationToken(null);
      setOtpSent(false);
      setOtp("");
      setOtpSuccess(null);
      setOtpError(null);
    }
  }

  async function handleSendOtp() {
    if (!email.trim() || !email.includes("@")) {
      setOtpError("Please enter a valid email address.");
      return;
    }

    setIsSendingOtp(true);
    setOtpError(null);
    setOtpSuccess(null);

    try {
      const res = await sendOtpApi(email);
      setOtpSent(true);
      setCooldown(res.cooldownSeconds || 60);
      setOtpSuccess(`Verification code dispatched to ${res.email}. Valid for 5 minutes.`);
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setOtpError("Please enter the 6-digit numeric verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);
    setOtpSuccess(null);

    try {
      const res = await verifyOtpApi(email, cleanOtp);
      if (res.verified) {
        setIsVerified(true);
        setVerifiedEmail(res.email);
        setVerificationToken(res.verificationToken ?? null);
        setOtpSuccess("✓ Email verified successfully!");
      }
    } catch (err: unknown) {
      setOtpError(err instanceof Error ? err.message : "Invalid code. Please check and retry.");
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  async function handleCompleteRegistration() {
    if (!name.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!studentId.trim()) {
      setFormError("Student ID is required.");
      return;
    }
    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (!isVerified) {
      setFormError("Please verify your email with OTP before completing registration.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const error = await register({
      name: name.trim(),
      email: verifiedEmail || email.trim(),
      studentId: studentId.trim(),
      password,
      verificationToken: verificationToken ?? undefined,
      otp: otp.trim() || undefined,
      role: "student",
    });

    setIsSubmitting(false);

    if (error) {
      setFormError(error);
    } else {
      router.replace("/(student)/dashboard");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Student Account</Text>
          <Text style={styles.headerSubtitle}>
            Accepts any valid email (Gmail, Outlook, Yahoo, College, etc.)
          </Text>
        </View>

        {formError ? <Alert tone="error">{formError}</Alert> : null}
        {otpSuccess ? <Alert tone="success">{otpSuccess}</Alert> : null}
        {otpError ? <Alert tone="error">{otpError}</Alert> : null}

        <Card>
          <TextInput
            label="Full Name"
            placeholder="Jane Doe"
            value={name}
            onChangeText={setName}
          />

          {/* Email with Send OTP inline button */}
          <View>
            <TextInput
              label="Email Address"
              placeholder="student@example.com (Gmail, College, etc.)"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isVerified}
              value={email}
              onChangeText={handleEmailChange}
              rightAction={
                <Button
                  title={
                    isSendingOtp
                      ? "Sending…"
                      : cooldown > 0
                        ? `${cooldown}s`
                        : otpSent
                          ? "Resend"
                          : "Send OTP"
                  }
                  onPress={handleSendOtp}
                  disabled={isSendingOtp || cooldown > 0 || isVerified}
                  variant={isVerified ? "outline" : "secondary"}
                  style={styles.otpBtn}
                  textStyle={styles.otpBtnText}
                />
              }
            />

            {isVerified ? (
              <View style={styles.verifiedRow}>
                <Badge label="✓ Email Verified" bg={Colors.successBg} textColor={Colors.success} />
                <TouchableOpacity
                  onPress={() => {
                    setIsVerified(false);
                    setVerifiedEmail("");
                    setVerificationToken(null);
                    setOtpSent(false);
                    setOtp("");
                    setOtpSuccess(null);
                  }}
                >
                  <Text style={styles.changeEmailText}>Change email</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* OTP Input Card */}
          {otpSent && !isVerified ? (
            <View style={styles.otpBox}>
              <View style={styles.otpBoxHeader}>
                <Text style={styles.otpBoxTitle}>Enter 6-digit verification code</Text>
                <Badge label="Expires in 5m" bg={Colors.infoBg} textColor={Colors.info} />
              </View>

              <View style={styles.otpInputRow}>
                <TextInput
                  placeholder="Enter 6-digit OTP"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  editable={!isVerifyingOtp}
                  selectTextOnFocus
                  onChangeText={(text) => {
                    setOtp(text.replace(/[^0-9]/g, "").slice(0, 6));
                    setOtpError(null);
                  }}
                  style={[
                    styles.otpField,
                    {
                      minWidth: 0,
                      flex: 1,
                      height: 46,
                      textAlign: "center",
                      letterSpacing: 3,
                    },
                  ]}
                />
                <Button
                  title={isVerifyingOtp ? "Verifying…" : "Verify"}
                  onPress={handleVerifyOtp}
                  loading={isVerifyingOtp}
                  disabled={otp.trim().length !== 6 || isVerifyingOtp}
                  style={styles.verifyBtn}
                />
              </View>
              <Text style={styles.otpHelp}>Dispatched to your inbox. Max 5 attempts allowed.</Text>
            </View>
          ) : null}

          <TextInput
            label="Student ID"
            placeholder="STU-12345"
            value={studentId}
            onChangeText={setStudentId}
          />

          <TextInput
            label="Password"
            placeholder="At least 6 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TextInput
            label="Confirm Password"
            placeholder="Repeat password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <Button
            title={
              isSubmitting
                ? "Creating account…"
                : !isVerified
                  ? "Verify Email with OTP to Proceed"
                  : "Complete Registration"
            }
            onPress={handleCompleteRegistration}
            loading={isSubmitting}
            disabled={!isVerified || isSubmitting}
            style={styles.registerBtn}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    padding: 20,
    paddingTop: 30,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.navy900,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  otpBtn: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  otpBtnText: {
    fontSize: 12,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: -6,
  },
  changeEmailText: {
    fontSize: 12,
    color: Colors.brand600,
    fontWeight: "500",
  },
  otpBox: {
    backgroundColor: Colors.brand50,
    borderWidth: 1,
    borderColor: Colors.brand100,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  otpBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  otpBoxTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.navy900,
  },
  otpInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  otpField: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 4,
  },
  verifyBtn: {
    height: 46,
    paddingHorizontal: 16,
  },
  otpHelp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
  },
  registerBtn: {
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  footerText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.brand600,
  },
});

