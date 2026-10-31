import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { Badge } from "../../src/components/ui/Badge";
import { Colors } from "../../src/theme/colors";

export default function StudentProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Header */}
      <View style={styles.avatarCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {user.name ? user.name.slice(0, 2).toUpperCase() : "ST"}
          </Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userRole}>Student Account</Text>
        <View style={styles.verificationBadge}>
          <Badge
            label={user.emailVerified ? "✓ Email Verified" : "Verification Pending"}
            bg={user.emailVerified ? "#dcfce7" : "#fef3c7"}
            textColor={user.emailVerified ? "#15803d" : "#b45309"}
          />
        </View>
      </View>

      {/* Account Details */}
      <Text style={styles.sectionTitle}>Student Details</Text>
      <Card style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Student ID</Text>
          <Text style={styles.detailValueMono}>{user.studentId || "N/A"}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email Address</Text>
          <Text style={styles.detailValue}>{user.email}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Role</Text>
          <Text style={styles.detailValue}>{user.role.toUpperCase()}</Text>
        </View>

        {user.phone ? (
          <>
            <View style={styles.separator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{user.phone}</Text>
            </View>
          </>
        ) : null}
      </Card>

      {/* Security & System Info */}
      <Text style={styles.sectionTitle}>App & Connection</Text>
      <Card style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>System</Text>
          <Text style={styles.detailValue}>Campus Signal Intelligence</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Platform</Text>
          <Text style={styles.detailValue}>{Platform.OS.toUpperCase()}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Session Storage</Text>
          <Text style={styles.detailValue}>Expo SecureStore (Encrypted)</Text>
        </View>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Back to Dashboard"
          variant="outline"
          onPress={() => router.replace("/(student)/dashboard")}
          style={styles.backBtn}
        />
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarCard: {
    alignItems: "center",
    backgroundColor: Colors.navy900,
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.brand500,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.white,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.white,
    marginBottom: 4,
  },
  userRole: {
    fontSize: 13,
    color: Colors.brand400,
    marginBottom: 10,
  },
  verificationBadge: {
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 10,
  },
  detailsCard: {
    marginBottom: 20,
    paddingVertical: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    color: Colors.navy900,
    fontWeight: "600",
  },
  detailValueMono: {
    fontSize: 13,
    color: Colors.navy900,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  actions: {
    gap: 12,
    marginTop: 10,
  },
  backBtn: {
    height: 44,
  },
  logoutBtn: {
    height: 44,
  },
});
