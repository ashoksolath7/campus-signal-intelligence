import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { getComplaintsApi } from "../../src/services/complaints";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { StatusBadge, PriorityBadge } from "../../src/components/ui/Badge";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type { Complaint } from "../../src/types/domain";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchMyComplaints = useCallback(async () => {
    try {
      if (!user) return;
      setErrorMessage(null);
      const data = await getComplaintsApi({ studentId: user.id });
      setComplaints(data);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to connect to campus backend. Pull down to retry.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyComplaints();
  }, [fetchMyComplaints]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyComplaints();
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  const totalCount = complaints.length;
  const pendingCount = complaints.filter(
    (c) => c.status === "submitted" || c.status === "in_review" || c.status === "assigned",
  ).length;
  const inProgressCount = complaints.filter((c) => c.status === "in_progress").length;
  const resolvedCount = complaints.filter((c) => c.status === "resolved" || c.status === "closed").length;

  if (loading) {
    return <LoadingSpinner message="Loading your campus portal…" />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand600]} />}
    >
      {/* Welcome Header */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeGreeting}>Welcome back,</Text>
        <Text style={styles.welcomeName}>{user?.name || "Student"}</Text>
        <Text style={styles.welcomeMeta}>
          ID: {user?.studentId || "STU"} • {user?.email}
        </Text>

        <View style={styles.headerActions}>
          <Button
            title="+ Submit Issue"
            onPress={() => router.push("/(student)/submit")}
            style={styles.quickSubmitBtn}
          />
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={() => router.push("/(student)/profile")}
              style={styles.profileBtn}
            >
              <Text style={styles.profileText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Alert tone="error">{errorMessage}</Alert>
          <Button
            title="Retry Connection"
            variant="outline"
            onPress={fetchMyComplaints}
            style={styles.retryBtn}
          />
        </View>
      ) : null}

      {/* Metrics Grid - Clickable for Fast Filtering */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.metricsGrid}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(student)/complaints")}
          style={[styles.metricCard, { borderLeftColor: Colors.brand600 }]}
        >
          <Text style={styles.metricVal}>{totalCount}</Text>
          <Text style={styles.metricLabel}>Total Tickets →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(student)/complaints")}
          style={[styles.metricCard, { borderLeftColor: Colors.info }]}
        >
          <Text style={styles.metricVal}>{pendingCount}</Text>
          <Text style={styles.metricLabel}>Pending →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(student)/complaints")}
          style={[styles.metricCard, { borderLeftColor: Colors.warning }]}
        >
          <Text style={styles.metricVal}>{inProgressCount}</Text>
          <Text style={styles.metricLabel}>In Progress →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(student)/complaints")}
          style={[styles.metricCard, { borderLeftColor: Colors.success }]}
        >
          <Text style={styles.metricVal}>{resolvedCount}</Text>
          <Text style={styles.metricLabel}>Resolved →</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Complaints */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Tickets</Text>
        <TouchableOpacity onPress={() => router.push("/(student)/complaints")}>
          <Text style={styles.seeAllLink}>See all ({totalCount})</Text>
        </TouchableOpacity>
      </View>

      {complaints.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No complaints submitted yet</Text>
          <Text style={styles.emptyDesc}>
            Need something fixed or reported on campus? Submit a ticket with automatic AI categorization.
          </Text>
          <Button
            title="Report an Issue"
            onPress={() => router.push("/(student)/submit")}
            style={styles.emptyBtn}
          />
        </Card>
      ) : (
        complaints.slice(0, 5).map((complaint) => (
          <TouchableOpacity
            key={complaint.id}
            activeOpacity={0.7}
            onPress={() => router.push(`/(student)/${complaint.id}` as any)}
          >
            <Card>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketNumber}>{complaint.ticket}</Text>
                <View style={styles.badgeGroup}>
                  <PriorityBadge priority={complaint.priority} />
                  <StatusBadge status={complaint.status} />
                </View>
              </View>
              <Text style={styles.ticketTitle} numberOfLines={1}>
                {complaint.title}
              </Text>
              <Text style={styles.ticketDesc} numberOfLines={2}>
                {complaint.description}
              </Text>
              <View style={styles.ticketFooter}>
                <Text style={styles.ticketMeta}>📍 {complaint.location}</Text>
                <Text style={styles.ticketMeta}>
                  {new Date(complaint.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
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
    paddingBottom: 30,
  },
  welcomeCard: {
    backgroundColor: Colors.navy900,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeGreeting: {
    fontSize: 13,
    color: Colors.brand400,
    fontWeight: "600",
  },
  welcomeName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.white,
    marginTop: 2,
  },
  welcomeMeta: {
    fontSize: 12,
    color: Colors.brand100,
    marginTop: 4,
    opacity: 0.8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.navy800,
  },
  quickSubmitBtn: {
    height: 38,
    paddingHorizontal: 16,
    backgroundColor: Colors.brand500,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: Colors.navy800,
  },
  profileText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  logoutText: {
    color: Colors.brand400,
    fontSize: 13,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 8,
  },
  seeAllLink: {
    fontSize: 13,
    color: Colors.brand600,
    fontWeight: "600",
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3.5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricVal: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.navy900,
  },
  metricLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: "500",
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  ticketNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navy900,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  badgeGroup: {
    flexDirection: "row",
    gap: 6,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.navy900,
    marginBottom: 4,
  },
  ticketDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  ticketMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.navy900,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
    lineHeight: 18,
  },
  emptyBtn: {
    paddingHorizontal: 20,
  },
  errorBanner: {
    marginBottom: 16,
  },
  retryBtn: {
    marginTop: 8,
  },
});

