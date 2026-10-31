import React from "react";
import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Colors } from "../../src/theme/colors";

export default function StudentLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Verifying session…" />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.navy900 },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: "Student Dashboard" }} />
      <Stack.Screen name="complaints" options={{ title: "My Complaints" }} />
      <Stack.Screen name="submit" options={{ title: "New Complaint" }} />
      <Stack.Screen name="[id]" options={{ title: "Complaint Details" }} />
      <Stack.Screen name="profile" options={{ title: "Profile & Settings" }} />
    </Stack>
  );
}
