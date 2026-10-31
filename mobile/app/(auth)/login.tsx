import React, { useState } from "react";
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
import { Button } from "../../src/components/ui/Button";
import { TextInput } from "../../src/components/ui/TextInput";
import { Alert } from "../../src/components/ui/Alert";
import { Card } from "../../src/components/ui/Card";
import { Colors } from "../../src/theme/colors";
import type { UserRole } from "../../src/types/domain";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { user: authedUser, error } = await login(email.trim(), password, role);
    setLoading(false);

    if (error) {
      setErrorMessage(error);
    } else if (authedUser) {
      if (authedUser.role === "admin" || authedUser.role === "staff") {
        router.replace("/(admin)/dashboard");
      } else {
        router.replace("/(student)/dashboard");
      }
    }
  }

  const handleFillDemo = (targetRole: UserRole) => {
    setRole(targetRole);
    if (targetRole === "admin") {
      setEmail("admin@campus.edu");
      setPassword("campus123");
    } else {
      setEmail("student@campus.edu");
      setPassword("campus123");
    }
    setErrorMessage(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>CSI</Text>
          </View>
          <Text style={styles.headerTitle}>Campus Signal Intelligence</Text>
          <Text style={styles.headerSubtitle}>Sign in to your campus operations portal</Text>
        </View>

        {/* Portal Role Selector */}
        <View style={styles.roleSelector}>
          {(["student", "admin"] as UserRole[]).map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRole(r)}
              style={[styles.roleTab, role === r && styles.roleTabActive]}
            >
              <Text style={[styles.roleTabText, role === r && styles.roleTabTextActive]}>
                {r === "student" ? "Student Portal" : "Admin Portal"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

        <Card>
          <TextInput
            label="Email Address"
            placeholder={role === "student" ? "student@campus.edu or gmail" : "admin@campus.edu"}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Button
            title={loading ? "Authenticating…" : `Sign in as ${role === "student" ? "Student" : "Admin"}`}
            onPress={handleLogin}
            loading={loading}
            style={styles.submitBtn}
          />
        </Card>

        {role === "student" ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>New student on campus? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
              <Text style={styles.footerLink}>Register with Email OTP</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Quick Demo Credentials Helper with 1-Tap Fill */}
        <View style={styles.demoHelper}>
          <Text style={styles.demoTitle}>One-Tap Demo Autofill:</Text>
          <View style={styles.demoBtnRow}>
            <TouchableOpacity
              style={styles.demoFillBtn}
              onPress={() => handleFillDemo("student")}
            >
              <Text style={styles.demoFillBtnText}>⚡ Fill Student Demo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoFillBtn, styles.demoFillBtnAdmin]}
              onPress={() => handleFillDemo("admin")}
            >
              <Text style={[styles.demoFillBtnText, styles.demoFillBtnAdminText]}>
                🛡️ Fill Admin Demo
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.demoSub}>
            Student: student@campus.edu • Admin: admin@campus.edu (Pass: campus123)
          </Text>
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
    paddingTop: 50,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.navy900,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.white,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.navy900,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
  roleSelector: {
    flexDirection: "row",
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  roleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  roleTabActive: {
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  roleTabTextActive: {
    color: Colors.brand600,
  },
  submitBtn: {
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
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
  demoHelper: {
    marginTop: 24,
    padding: 14,
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  demoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  demoBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  demoFillBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: Colors.brand50,
    borderWidth: 1,
    borderColor: Colors.brand100,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  demoFillBtnAdmin: {
    backgroundColor: Colors.borderLight,
    borderColor: Colors.border,
  },
  demoFillBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.brand700,
  },
  demoFillBtnAdminText: {
    color: Colors.navy900,
  },
  demoSub: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
});

