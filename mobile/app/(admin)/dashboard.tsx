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
import { getAnalyticsApi } from "../../src/services/analytics";
import { getComplaintsApi } from "../../src/services/complaints";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { PriorityBadge, StatusBadge, Badge } from "../../src/components/ui/Badge";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type { Complaint, AnalyticsSummary } from "../../src/types/domain";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [analyticsData, complaintsData] = await Promise.all([
        getAnalyticsApi(),
        getComplaintsApi(),
      ]);
      setAnalytics(analyticsData);
      setComplaints(complaintsData);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to load admin command operations data. Pull down to retry.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAdminData();
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/login");
  };

  if (loading) {
    return <LoadingSpinner message="Loading Operations Command Center…" />;
  }

  const total = analytics?.totalComplaints ?? complaints.length;
  const pending = analytics?.pendingComplaints ?? complaints.filter((c) => ["submitted", "in_review", "assigned"].includes(c.status)).length;
  const inProgress = complaints.filter((c) => c.status === "in_progress").length;
  const critical = analytics?.criticalComplaints ?? complaints.filter((c) => c.priority === "critical" || c.priority === "high").length;
  const resolved = analytics?.resolvedComplaints ?? complaints.filter((c) => ["resolved", "closed"].includes(c.status)).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand600]} />}
    >
      {/* Admin Operations Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerHeaderRow}>
          <View style={styles.bannerBadge}>
            <Text style={styles.bannerBadgeText}>COMMAND CONSOLE</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.bannerName}>{user?.name || "Operations Administrator"}</Text>
        <Text style={styles.bannerRole}>
          {user?.role?.toUpperCase()} • {user?.email}
        </Text>
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Alert tone="error">{errorMessage}</Alert>
          <Button
            title="Retry Connection"
            variant="outline"
            onPress={fetchAdminData}
            style={styles.retryBtn}
          />
        </View>
      ) : null}

      {/* Primary KPI Metrics - Clickable for Direct Triage Filter */}
      <Text style={styles.sectionTitle}>Operations Overview</Text>
      <View style={styles.metricsGrid}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(admin)/complaints")}
          style={[styles.metricCard, { borderLeftColor: Colors.brand600 }]}
        >
          <Text style={styles.metricVal}>{total}</Text>
          <Text style={styles.metricLabel}>Total Tickets →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(admin)/complaints")}
          style={[styles.metricCard, { borderLeftColor: Colors.warning }]}
        >
          <Text style={styles.metricVal}>{pending}</Text>
          <Text style={styles.metricLabel}>Pending Action →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(admin)/complaints")}
          style={[styles.metricCard, { borderLeftColor: Colors.info }]}
        >
          <Text style={styles.metricVal}>{inProgress}</Text>
          <Text style={styles.metricLabel}>In Progress →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(admin)/complaints")}
          style={[styles.metricCard, { borderLeftColor: Colors.danger }]}
        >
          <Text style={styles.metricVal}>{critical}</Text>
          <Text style={styles.metricLabel}>Critical/High →</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Navigation Action Grid */}
      <Text style={styles.sectionTitle}>Management Modules</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.8}
          onPress={() => router.push("/(admin)/complaints")}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionTitle}>Complaint Triage</Text>
          <Text style={styles.actionDesc}>Review, assign, and update status of all campus tickets</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.8}
          onPress={() => router.push("/(admin)/duplicates")}
        >
          <Text style={styles.actionIcon}>✨</Text>
          <Text style={styles.actionTitle}>Duplicate Intel</Text>
          <Text style={styles.actionDesc}>Review AI suggested duplicate clusters & merge approvals</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.8}
          onPress={() => router.push("/(admin)/departments")}
        >
          <Text style={styles.actionIcon}>🏢</Text>
          <Text style={styles.actionTitle}>Departments</Text>
          <Text style={styles.actionDesc}>Manage operational routing and monitor team workload</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.8}
          onPress={() => router.push("/(admin)/audit")}
        >
          <Text style={styles.actionIcon}>🛡️</Text>
          <Text style={styles.actionTitle}>Audit Trails</Text>
          <Text style={styles.actionDesc}>Track operations events, security updates, and actor logs</Text>
        </TouchableOpacity>
      </View>

      {/* Department Workload Breakdown */}
      {analytics?.departmentDistribution && analytics.departmentDistribution.length > 0 ? (
        <View style={styles.analyticsSection}>
          <Text style={styles.sectionTitle}>Department Workload</Text>
          <Card>
            {analytics.departmentDistribution.map((dept, index) => {
              const maxCount = Math.max(...analytics.departmentDistribution.map((d) => d.count), 1);
              const pct = Math.round((dept.count / maxCount) * 100);
              return (
                <View key={dept.departmentId || dept.code || String(index)} style={styles.barItem}>
                  <View style={styles.barHeader}>
                    <Text style={styles.barLabel}>{dept.name} ({dept.code})</Text>
                    <Text style={styles.barCount}>{dept.count} tickets</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: Colors.brand600 }]} />
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}

      {/* Category Breakdown */}
      {analytics?.categoryDistribution && analytics.categoryDistribution.length > 0 ? (
        <View style={styles.analyticsSection}>
          <Text style={styles.sectionTitle}>Category Distribution</Text>
          <Card>
            {analytics.categoryDistribution.map((cat, index) => {
              const maxVal = Math.max(...analytics.categoryDistribution.map((c) => c.value), 1);
              const pct = Math.round((cat.value / maxVal) * 100);
              return (
                <View key={cat.category || String(index)} style={styles.barItem}>
                  <View style={styles.barHeader}>
                    <Text style={styles.barLabel}>{cat.name}</Text>
                    <Text style={styles.barCount}>{cat.value} reports</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: Colors.navy700 }]} />
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}

      {/* Recent Incident Feed */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Incidents</Text>
        <TouchableOpacity onPress={() => router.push("/(admin)/complaints")}>
          <Text style={styles.seeAllLink}>View All ({complaints.length})</Text>
        </TouchableOpacity>
      </View>

      {complaints.slice(0, 5).map((complaint) => (
        <TouchableOpacity
          key={complaint.id}
          activeOpacity={0.7}
          onPress={() => router.push(`/(admin)/${complaint.id}` as any)}
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
              <Text style={styles.ticketMeta}>👤 {complaint.studentName || complaint.studentEmail}</Text>
              <Text style={styles.ticketMeta}>📍 {complaint.location}</Text>
            </View>
          </Card>
        </TouchableOpacity>
      ))}
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
  banner: {
    backgroundColor: Colors.navy900,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  bannerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  bannerBadge: {
    backgroundColor: Colors.navy800,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.brand500,
  },
  bannerBadgeText: {
    color: Colors.brand400,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.navy800,
  },
  logoutText: {
    color: Colors.brand400,
    fontSize: 12,
    fontWeight: "600",
  },
  bannerName: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.white,
    marginBottom: 2,
  },
  bannerRole: {
    fontSize: 13,
    color: Colors.brand100,
    opacity: 0.85,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  seeAllLink: {
    fontSize: 13,
    color: Colors.brand600,
    fontWeight: "700",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: Colors.white,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricVal: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.navy900,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: "600",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  analyticsSection: {
    marginBottom: 20,
  },
  barItem: {
    marginBottom: 12,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navy900,
  },
  barCount: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  barTrack: {
    height: 7,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
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
    fontSize: 14,
    fontWeight: "600",
    color: Colors.navy900,
    marginBottom: 4,
  },
  ticketDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
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
  errorBanner: {
    marginBottom: 16,
  },
  retryBtn: {
    marginTop: 8,
  },
});
