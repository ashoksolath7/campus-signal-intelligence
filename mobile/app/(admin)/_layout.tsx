import React from "react";
import { Stack, Redirect } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Colors } from "../../src/theme/colors";

export default function AdminLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="Verifying administrative credentials…" />;
  }

  if (!user || (user.role !== "admin" && user.role !== "staff")) {
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
      <Stack.Screen name="dashboard" options={{ title: "Operations Console" }} />
      <Stack.Screen name="complaints" options={{ title: "Complaint Management" }} />
      <Stack.Screen name="[id]" options={{ title: "Complaint Workflow" }} />
      <Stack.Screen name="duplicates" options={{ title: "Duplicate Intelligence" }} />
      <Stack.Screen name="departments" options={{ title: "Campus Departments" }} />
      <Stack.Screen name="audit" options={{ title: "Audit Trails" }} />
    </Stack>
  );
}
