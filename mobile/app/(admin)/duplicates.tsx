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
import { getSuggestedDuplicatesApi } from "../../src/services/ai";
import { groupComplaintsApi } from "../../src/services/complaints";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type { SuggestedDuplicateGroup } from "../../src/types/domain";

export default function DuplicateManagementScreen() {
  const router = useRouter();

  const [groups, setGroups] = useState<SuggestedDuplicateGroup[]>([]);
  const [engine, setEngine] = useState<string>("sentence-transformers");
  const [candidates, setCandidates] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupingId, setGroupingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const fetchClusters = useCallback(async () => {
    try {
      setFeedback(null);
      const res = await getSuggestedDuplicatesApi();
      setGroups(res.suggestedGroups || []);
      setEngine(res.engine || "sentence-transformers");
      setCandidates(res.totalCandidates || 0);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to scan duplicate clusters.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClusters();
  };

  const handleApproveGroup = async (group: SuggestedDuplicateGroup) => {
    try {
      setGroupingId(group.groupId);
      setFeedback(null);

      // Explicit Admin Approval: group each secondary candidate with the primary ticket
      for (const memberId of group.memberIds) {
        await groupComplaintsApi(group.primaryId, memberId);
      }

      setFeedback({
        type: "success",
        text: `Cluster approved! Primary ${group.primaryTicket} successfully linked with ${group.memberTickets.join(", ")}.`,
      });

      // Re-scan clusters to reflect newly grouped tickets
      await fetchClusters();
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to consolidate duplicate cluster.",
      });
    } finally {
      setGroupingId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Scanning semantic duplicate clusters…" />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand600]} />
      }
    >
      {/* Header Overview Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View>
            <Text style={styles.summaryTitle}>Semantic Duplicate Engine</Text>
            <Text style={styles.summaryEngine}>{engine}</Text>
          </View>
          <View style={styles.clusterBadge}>
            <Text style={styles.clusterBadgeNum}>{groups.length}</Text>
            <Text style={styles.clusterBadgeLabel}>CLUSTERS</Text>
          </View>
        </View>

        <Text style={styles.summaryNotice}>
          Active Tickets Analyzed: {candidates}. Duplicates are never automatically merged. Admin
          approval is mandatory to maintain auditable record provenance.
        </Text>
      </Card>

      {/* Feedback Alert */}
      {feedback ? (
        <View style={styles.alertSpacing}>
          <Alert tone={feedback.type}>{feedback.text}</Alert>
        </View>
      ) : null}

      {/* Clusters List */}
      {groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={styles.emptyTitle}>No Duplicate Clusters Found</Text>
          <Text style={styles.emptyDesc}>
            Semantic similarity scanning evaluated all active student complaints against current
            thresholds. No redundant or overlapping tickets require manual grouping at this time.
          </Text>
          <Button
            title="Scan Again"
            variant="outline"
            onPress={onRefresh}
            style={styles.scanBtn}
          />
        </View>
      ) : (
        groups.map((group) => {
          const isProcessing = groupingId === group.groupId;
          const similarityPct = Math.round(group.averageSimilarity * 100);

          return (
            <Card key={group.groupId} style={styles.clusterCard}>
              {/* Cluster Title & Similarity Header */}
              <View style={styles.clusterHeader}>
                <View style={styles.themeWrap}>
                  <Text style={styles.clusterLabel}>SUSPECTED CLUSTER</Text>
                  <Text style={styles.commonThemeText}>{group.commonTheme}</Text>
                </View>
                <View
                  style={[
                    styles.simTag,
                    similarityPct >= 75 ? styles.simTagHigh : styles.simTagMed,
                  ]}
                >
                  <Text style={styles.simTagVal}>{similarityPct}%</Text>
                  <Text style={styles.simTagLabel}>SIMILARITY</Text>
                </View>
              </View>

              {/* Primary Anchor Complaint */}
              <View style={styles.anchorSection}>
                <Text style={styles.sectionSubtitle}>Primary Incident Anchor</Text>
                <TouchableOpacity
                  style={styles.ticketPillPrimary}
                  onPress={() => router.push(`/(admin)/${group.primaryId}` as any)}
                >
                  <Text style={styles.ticketPrimaryNum}>📌 {group.primaryTicket}</Text>
                  <Text style={styles.ticketActionHint}>View Ticket →</Text>
                </TouchableOpacity>
              </View>

              {/* Secondary Duplicate Members */}
              <View style={styles.membersSection}>
                <Text style={styles.sectionSubtitle}>
                  Duplicate Candidates ({group.memberTickets.length})
                </Text>
                <View style={styles.membersList}>
                  {group.memberTickets.map((ticket, idx) => {
                    const memberId = group.memberIds[idx];
                    return (
                      <TouchableOpacity
                        key={ticket}
                        style={styles.memberPill}
                        onPress={() => {
                          if (memberId) {
                            router.push(`/(admin)/${memberId}` as any);
                          }
                        }}
                      >
                        <Text style={styles.memberTicketNum}>{ticket}</Text>
                        <Text style={styles.memberChevron}>→</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Semantic Evidence */}
              {group.evidence ? (
                <View style={styles.evidenceBox}>
                  <Text style={styles.evidenceTitle}>AI Similarity Evidence</Text>
                  <Text style={styles.evidenceText}>{group.evidence}</Text>
                </View>
              ) : null}

              {/* Manual Admin Approval Action */}
              <View style={styles.actionRow}>
                <Button
                  title={
                    isProcessing
                      ? "Consolidating…"
                      : `Approve & Link Group (${group.memberTickets.length + 1} Tickets)`
                  }
                  onPress={() => handleApproveGroup(group)}
                  loading={isProcessing}
                  style={styles.approveBtn}
                />
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
  summaryCard: {
    backgroundColor: Colors.navy900,
    marginBottom: 12,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
  },
  summaryEngine: {
    fontSize: 11,
    color: "#93c5fd",
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  clusterBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  clusterBadgeNum: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.white,
  },
  clusterBadgeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#93c5fd",
    letterSpacing: 0.5,
  },
  summaryNotice: {
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 18,
  },
  alertSpacing: {
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 10,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  scanBtn: {
    minWidth: 140,
  },
  clusterCard: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clusterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  themeWrap: {
    flex: 1,
    marginRight: 10,
  },
  clusterLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.brand600,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  commonThemeText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.navy900,
  },
  simTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center",
  },
  simTagHigh: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  simTagMed: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  simTagVal: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.navy900,
  },
  simTagLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  anchorSection: {
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  ticketPillPrimary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ticketPrimaryNum: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.navy900,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  ticketActionHint: {
    fontSize: 12,
    color: Colors.brand700,
    fontWeight: "600",
  },
  membersSection: {
    marginBottom: 12,
  },
  membersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  memberTicketNum: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textPrimary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  memberChevron: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  evidenceBox: {
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  evidenceTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 4,
  },
  evidenceText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionRow: {
    marginTop: 4,
  },
  approveBtn: {
    backgroundColor: Colors.navy900,
  },
});

