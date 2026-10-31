import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { Colors } from "../src/theme/colors";

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/(auth)/login");
    } else if (user.role === "admin" || user.role === "staff") {
      router.replace("/(admin)/dashboard");
    } else {
      router.replace("/(student)/dashboard");
    }
  }, [user, loading, router]);

  return (
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>CSI</Text>
        </View>
        <Text style={styles.title}>Campus Signal Intelligence</Text>
        <Text style={styles.subtitle}>AI-Powered Campus Operations & Complaint Management</Text>
      </View>
      <ActivityIndicator size="large" color={Colors.brand400} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy900,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  brandContainer: {
    alignItems: "center",
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.brand600,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.white,
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.white,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: Colors.brand100,
    marginTop: 8,
    textAlign: "center",
    opacity: 0.8,
  },
  spinner: {
    marginTop: 40,
  },
});

