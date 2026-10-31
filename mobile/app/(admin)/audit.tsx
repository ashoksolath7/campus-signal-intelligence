import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { getAuditLogsApi } from "../../src/services/audit";
import { Card } from "../../src/components/ui/Card";
import { TextInput } from "../../src/components/ui/TextInput";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type { AuditLog } from "../../src/types/domain";

const ACTION_FILTERS = [
  { label: "All Actions", value: "all" },
  { label: "Update Complaint", value: "update_complaint" },
  { label: "Group Tickets", value: "group_complaints" },
  { label: "Create Complaint", value: "create_complaint" },
  { label: "Department", value: "department" },
  { label: "User / Auth", value: "user" },
];

export default function AdminAuditScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setErrorMessage(null);
      const data = await getAuditLogsApi();
      // Reverse or sort descending by timestamp so latest events appear first
      const sorted = [...data].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );
      setLogs(sorted);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load audit logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by action
      if (selectedAction !== "all") {
        if (selectedAction === "department") {
          if (!log.action.includes("department")) return false;
        } else if (selectedAction === "user") {
          if (!log.action.includes("user") && !log.action.includes("login") && !log.action.includes("register"))
            return false;
        } else if (log.action !== selectedAction) {
          return false;
        }
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesActor = log.actor.toLowerCase().includes(query);
        const matchesAction = log.action.toLowerCase().includes(query);
        const matchesTarget = log.target.toLowerCase().includes(query);
        const matchesDetail = log.detail.toLowerCase().includes(query);
        if (!matchesActor && !matchesAction && !matchesTarget && !matchesDetail) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedAction, searchQuery]);

  const getActionBadgeColor = (action: string) => {
    if (action.includes("delete") || action.includes("reject")) {
      return { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" };
    }
    if (action.includes("group") || action.includes("link")) {
      return { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe" };
    }
    if (action.includes("update") || action.includes("patch")) {
      return { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" };
    }
    if (action.includes("create") || action.includes("register")) {
      return { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" };
    }
    return { bg: "#f8fafc", text: "#475569", border: "#cbd5e1" };
  };

  if (loading) {
    return <LoadingSpinner message="Fetching administrative audit trail…" />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand600]} />
      }
    >
      {/* Top Header Card */}
      <Card style={styles.headerCard}>
        <Text style={styles.headerTitle}>Administrative Audit Trail</Text>
        <Text style={styles.headerSubtitle}>
          Immutable record of workflow transitions, department configurations, and administrative
          modifications.
        </Text>
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>
            Showing {filteredLogs.length} of {logs.length} logged events
          </Text>
        </View>
      </Card>

      {/* Error alert */}
      {errorMessage ? (
        <View style={styles.alertSpacing}>
          <Alert tone="error">{errorMessage}</Alert>
        </View>
      ) : null}

      {/* Search Bar */}
      <TextInput
        placeholder="Search actor, target ticket, action, or note…"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
      />

      {/* Action Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterTrack}
      >
        {ACTION_FILTERS.map((f) => {
          const isSelected = selectedAction === f.value;
          return (
            <TouchableOpacity
              key={f.value}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => setSelectedAction(f.value)}
            >
              <Text
                style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Logs Feed */}
      {filteredLogs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📜</Text>
          <Text style={styles.emptyTitle}>No Matching Audit Events</Text>
          <Text style={styles.emptyDesc}>
            No operational events match your search query or filter selection.
          </Text>
        </View>
      ) : (
        filteredLogs.map((log) => {
          const badgeStyle = getActionBadgeColor(log.action);
          const dateObj = new Date(log.at);
          const formattedDate = dateObj.toLocaleDateString();
          const formattedTime = dateObj.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });

          return (
            <Card key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View
                  style={[
                    styles.actionBadge,
                    {
                      backgroundColor: badgeStyle.bg,
                      borderColor: badgeStyle.border,
                    },
                  ]}
                >
                  <Text style={[styles.actionBadgeText, { color: badgeStyle.text }]}>
                    {log.action.replace(/_/g, " ").toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.timestampText}>
                  {formattedDate} {formattedTime}
                </Text>
              </View>

              <Text style={styles.detailText}>{log.detail}</Text>

              <View style={styles.logFooter}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>ACTOR</Text>
                  <Text style={styles.actorValue}>{log.actor}</Text>
                </View>

                <View style={styles.metaColRight}>
                  <Text style={styles.metaLabel}>TARGET RESOURCE</Text>
                  <Text style={styles.targetValue}>{log.target}</Text>
                </View>
              </View>
            </Card>
          );
        })
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
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: Colors.white,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  counterRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  counterText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.brand700,
  },
  alertSpacing: {
    marginBottom: 12,
  },
  searchInput: {
    marginBottom: 10,
  },
  filterScroll: {
    marginBottom: 12,
  },
  filterTrack: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.navy900,
    borderColor: Colors.navy900,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  logCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  actionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timestampText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  detailText: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: 10,
  },
  logFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  metaCol: {
    flex: 1,
  },
  metaColRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  actorValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navy900,
  },
  targetValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.brand700,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});

