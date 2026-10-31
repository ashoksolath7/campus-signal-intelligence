import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  Platform,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getComplaintByIdApi } from "../../src/services/complaints";
import { getDepartmentByIdApi } from "../../src/services/departments";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { PriorityBadge, StatusBadge } from "../../src/components/ui/Badge";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type { Complaint, Department } from "../../src/types/domain";

export default function ComplaintDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    try {
      setErrorMessage(null);
      const data = await getComplaintByIdApi(id);
      setComplaint(data);

      if (data.departmentId) {
        try {
          const dept = await getDepartmentByIdApi(data.departmentId);
          setDepartment(dept);
        } catch {
          // Non-fatal if department details endpoint fails
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load complaint details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDetails();
  };

  if (loading) {
    return <LoadingSpinner message="Fetching ticket details…" />;
  }

  if (errorMessage || !complaint) {
    return (
      <View style={styles.errorContainer}>
        <Alert tone="error">{errorMessage || "Complaint record not found."}</Alert>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand600]} />
      }
    >
      {/* Top Banner Card */}
      <Card style={styles.headerCard}>
        <View style={styles.ticketMetaRow}>
          <Text style={styles.ticketText}>{complaint.ticket}</Text>
          <View style={styles.badgeGroup}>
            <PriorityBadge priority={complaint.priority} />
            <StatusBadge status={complaint.status} />
          </View>
        </View>

        <Text style={styles.titleText}>{complaint.title}</Text>
        <Text style={styles.createdText}>
          Submitted on {new Date(complaint.createdAt).toLocaleString()}
        </Text>
      </Card>

      {/* Duplicate Grouping Info */}
      {complaint.duplicateGroupId ? (
        <View style={styles.duplicateBanner}>
          <Text style={styles.duplicateIcon}>🔗</Text>
          <View style={styles.duplicateTextCol}>
            <Text style={styles.duplicateTitle}>Linked to Duplicate Group</Text>
            <Text style={styles.duplicateDesc}>
              Group Ref: {complaint.duplicateGroupId}. Consolidated for collective resolution.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Main Details */}
      <Card>
        <Text style={styles.sectionHeader}>Details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category</Text>
          <Text style={styles.infoValue}>{complaint.category.toUpperCase()}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>{complaint.location}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Assigned Department</Text>
          <Text style={styles.infoValue}>
            {department ? `${department.name} (${department.code})` : complaint.departmentId}
          </Text>
        </View>

        {department?.head ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Department Contact</Text>
            <Text style={styles.infoValue}>{department.head} • {department.email}</Text>
          </View>
        ) : null}

        <View style={styles.descBlock}>
          <Text style={styles.infoLabel}>Description</Text>
          <Text style={styles.descText}>{complaint.description}</Text>
        </View>

        {/* Attached Photo Evidence */}
        {complaint.imageUrl ? (
          <View style={styles.imageBlock}>
            <View style={styles.imageHeaderRow}>
              <Text style={styles.infoLabel}>Photo Evidence Attached</Text>
              <TouchableOpacity onPress={() => setPhotoModalVisible(true)}>
                <Text style={styles.tapToExpandText}>Tap to expand 🔍</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setPhotoModalVisible(true)}
              style={styles.imageWrapper}
            >
              <Image source={{ uri: complaint.imageUrl }} style={styles.attachedImage} />
            </TouchableOpacity>
          </View>
        ) : null}
      </Card>

      {/* Status Timeline */}
      <Card>
        <Text style={styles.sectionHeader}>Status Timeline ({complaint.updates?.length || 0})</Text>

        {(!complaint.updates || complaint.updates.length === 0) ? (
          <Text style={styles.noUpdates}>No status updates recorded yet.</Text>
        ) : (
          complaint.updates.map((up, idx) => (
            <View key={idx} style={styles.timelineItem}>
              <View style={styles.timelinePoint}>
                <View style={styles.timelineDot} />
                {idx < (complaint.updates.length - 1) ? <View style={styles.timelineLine} /> : null}
              </View>

              <View style={styles.timelineContent}>
                <View style={styles.timelineHeader}>
                  <StatusBadge status={up.status} />
                  <Text style={styles.timelineTime}>
                    {new Date(up.at).toLocaleDateString()} {new Date(up.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.timelineNote}>{up.note}</Text>
                <Text style={styles.timelineActor}>Updated by: {up.actor}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* In-Screen Navigation Actions */}
      <View style={styles.bottomActions}>
        <Button
          title="← Back to My Complaints"
          variant="outline"
          onPress={() => router.replace("/(student)/complaints")}
          style={styles.backBtn}
        />
        <Button
          title="+ Report Another Issue"
          onPress={() => router.push("/(student)/submit")}
          style={styles.newReportBtn}
        />
      </View>

      {/* Full-screen Photo Modal */}
      {complaint.imageUrl ? (
        <Modal
          visible={photoModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPhotoModalVisible(false)}
        >
          <View style={styles.photoModalOverlay}>
            <TouchableOpacity
              style={styles.photoModalCloseBtn}
              onPress={() => setPhotoModalVisible(false)}
            >
              <Text style={styles.photoModalCloseText}>✕ Close</Text>
            </TouchableOpacity>
            <Image
              source={{ uri: complaint.imageUrl }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      ) : null}
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
  errorContainer: {
    padding: 20,
    marginTop: 40,
  },
  headerCard: {
    backgroundColor: Colors.white,
    marginBottom: 12,
  },
  ticketMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ticketText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.navy900,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  badgeGroup: {
    flexDirection: "row",
    gap: 6,
  },
  titleText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 6,
  },
  createdText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  duplicateBanner: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 10,
    alignItems: "center",
  },
  duplicateIcon: {
    fontSize: 20,
  },
  duplicateTextCol: {
    flex: 1,
  },
  duplicateTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  duplicateDesc: {
    fontSize: 12,
    color: "#2563eb",
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: "600",
    maxWidth: "60%",
    textAlign: "right",
  },
  descBlock: {
    paddingTop: 10,
    marginBottom: 10,
  },
  descText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  imageBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  imageWrapper: {
    marginTop: 8,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  attachedImage: {
    width: "100%",
    height: 220,
    resizeMode: "cover",
  },
  noUpdates: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: "italic",
    paddingVertical: 10,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 14,
  },
  timelinePoint: {
    alignItems: "center",
    width: 24,
    marginRight: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.brand600,
    marginTop: 6,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
    padding: 10,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  timelineNote: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: 4,
  },
  timelineActor: {
    fontSize: 11,
    color: Colors.brand700,
    fontWeight: "500",
  },
  imageHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tapToExpandText: {
    fontSize: 12,
    color: Colors.brand600,
    fontWeight: "600",
  },
  bottomActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    marginBottom: 20,
  },
  backBtn: {
    flex: 1,
  },
  newReportBtn: {
    flex: 1,
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  photoModalCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  photoModalCloseText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
  fullScreenImage: {
    width: "100%",
    height: "80%",
  },
});

