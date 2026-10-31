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
import { TextInput } from "../../src/components/ui/TextInput";
import { Button } from "../../src/components/ui/Button";
import { PriorityBadge, StatusBadge } from "../../src/components/ui/Badge";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type { Complaint } from "../../src/types/domain";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "submitted", label: "Submitted" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

export default function MyComplaintsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchComplaints = useCallback(async () => {
    if (!user) return;
    try {
      setErrorMessage(null);
      const data = await getComplaintsApi({
        studentId: user.id,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setComplaints(data);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to load complaints from backend. Pull down to refresh.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, statusFilter, searchQuery]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplaints();
  };

  return (
    <View style={styles.container}>
      {/* Top Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search by title, ticket # or location…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {/* Status Filters Horizontal List */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setStatusFilter(f.id)}
              style={[styles.filterChip, statusFilter === f.id && styles.filterChipActive]}
            >
              <Text
                style={[styles.filterChipText, statusFilter === f.id && styles.filterChipTextActive]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Alert tone="error">{errorMessage}</Alert>
          <Button
            title="Retry"
            variant="outline"
            onPress={fetchComplaints}
            style={styles.retryBtn}
          />
        </View>
      ) : null}

      {/* Complaints List */}
      {loading ? (
        <LoadingSpinner message="Fetching your complaints…" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.brand600]}
            />
          }
        >
          {complaints.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No complaints found</Text>
              <Text style={styles.emptyDesc}>
                {statusFilter !== "all" || searchQuery
                  ? "Try resetting your search or status filter."
                  : "You have not submitted any complaints yet."}
              </Text>
              <Button
                title="Submit a Ticket"
                onPress={() => router.push("/(student)/submit")}
                style={styles.emptyBtn}
              />
            </Card>
          ) : (
            complaints.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/(student)/${item.id}` as any)}
              >
                <Card>
                  <View style={styles.cardHeader}>
                    <Text style={styles.ticketNumber}>{item.ticket}</Text>
                    <View style={styles.badgeGroup}>
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </View>
                  </View>

                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.desc} numberOfLines={2}>
                    {item.description}
                  </Text>

                  <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>📍 {item.location}</Text>
                    <Text style={styles.footerText}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    height: 40,
    fontSize: 13,
  },
  filterScroll: {
    flexDirection: "row",
    marginTop: 4,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.navy900,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  cardHeader: {
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
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.navy900,
    marginBottom: 4,
  },
  desc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 36,
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
    marginHorizontal: 16,
    marginBottom: 12,
  },
  retryBtn: {
    marginTop: 8,
  },
});
