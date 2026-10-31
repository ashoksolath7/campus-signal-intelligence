import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getComplaintByIdApi, patchComplaintApi } from "../../src/services/complaints";
import { getDepartmentsApi } from "../../src/services/departments";
import { classifyComplaintApi } from "../../src/services/ai";
import { Card } from "../../src/components/ui/Card";
import { PriorityBadge, StatusBadge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { TextInput } from "../../src/components/ui/TextInput";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type {
  Complaint,
  Department,
  ComplaintStatus,
  Priority,
  AIClassifyResult,
} from "../../src/types/domain";

const STATUS_OPTIONS: { label: string; value: ComplaintStatus }[] = [
  { label: "Submitted", value: "submitted" },
  { label: "In Review", value: "in_review" },
  { label: "Assigned", value: "assigned" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];

const PRIORITY_OPTIONS: { label: string; value: Priority; color: string }[] = [
  { label: "Low", value: "low", color: "#64748b" },
  { label: "Medium", value: "medium", color: "#0284c7" },
  { label: "High", value: "high", color: "#d97706" },
  { label: "Critical", value: "critical", color: "#dc2626" },
];

export default function AdminComplaintWorkflowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIClassifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

  // Form states
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus>("submitted");
  const [selectedPriority, setSelectedPriority] = useState<Priority>("medium");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [triageNote, setTriageNote] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Department selector modal
  const [showDeptModal, setShowDeptModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setFeedback(null);
      const [complaintData, deptsData] = await Promise.all([
        getComplaintByIdApi(id),
        getDepartmentsApi().catch(() => [] as Department[]),
      ]);

      setComplaint(complaintData);
      setDepartments(deptsData);
      setSelectedStatus(complaintData.status);
      setSelectedPriority(complaintData.priority);
      setSelectedDepartmentId(complaintData.departmentId || "");

      // Auto-run AI explainability for the complaint
      try {
        setAnalyzingAi(true);
        const aiRes = await classifyComplaintApi({
          title: complaintData.title,
          description: complaintData.description,
          location: complaintData.location,
        });
        setAiAnalysis(aiRes);
      } catch {
        // Non-blocking if AI service is temporarily slow
      } finally {
        setAnalyzingAi(false);
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load complaint data.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleApplyTriage = async () => {
    if (!complaint) return;
    try {
      setSubmitting(true);
      setFeedback(null);

      const hasStatusChanged = selectedStatus !== complaint.status;
      const hasPriorityChanged = selectedPriority !== complaint.priority;
      const hasDeptChanged = selectedDepartmentId !== complaint.departmentId;

      if (!hasStatusChanged && !hasPriorityChanged && !hasDeptChanged && !triageNote.trim()) {
        setFeedback({
          type: "error",
          text: "No modifications detected. Change a status, priority, department, or add a note.",
        });
        setSubmitting(false);
        return;
      }

      const noteText =
        triageNote.trim() ||
        `Status set to ${selectedStatus.replace("_", " ")}, priority ${selectedPriority}.`;

      const updated = await patchComplaintApi(complaint.id, {
        status: selectedStatus,
        priority: selectedPriority,
        departmentId: selectedDepartmentId || undefined,
        note: noteText,
      });

      setComplaint(updated);
      setSelectedStatus(updated.status);
      setSelectedPriority(updated.priority);
      setSelectedDepartmentId(updated.departmentId || "");
      setTriageNote("");
      setFeedback({
        type: "success",
        text: `Triage successfully updated for ${updated.ticket}.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update complaint.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const assignedDept = departments.find((d) => d.id === selectedDepartmentId);

  if (loading) {
    return <LoadingSpinner message="Loading complaint details & AI triage…" />;
  }

  if (!complaint) {
    return (
      <View style={styles.errorContainer}>
        <Alert tone="error">{feedback?.text || "Complaint record not found."}</Alert>
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
      {/* Feedback banner */}
      {feedback ? (
        <View style={styles.alertSpacing}>
          <Alert tone={feedback.type}>{feedback.text}</Alert>
        </View>
      ) : null}

      {/* Header Ticket Card */}
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
          Submitted {new Date(complaint.createdAt).toLocaleString()}
        </Text>
      </Card>

      {/* Duplicate Indicator */}
      {complaint.duplicateGroupId ? (
        <View style={styles.duplicateBanner}>
          <Text style={styles.duplicateIcon}>🔗</Text>
          <View style={styles.duplicateTextCol}>
            <Text style={styles.duplicateTitle}>Consolidated Duplicate Cluster</Text>
            <Text style={styles.duplicateDesc}>
              Linked to Group ID: {complaint.duplicateGroupId}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Submitter & Incident Info */}
      <Card>
        <Text style={styles.sectionHeader}>Incident & Submitter Info</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Student Name</Text>
          <Text style={styles.infoValue}>{complaint.studentName}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Student Email</Text>
          <Text style={styles.infoValue}>{complaint.studentEmail}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category</Text>
          <Text style={styles.infoValue}>{complaint.category.toUpperCase()}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>{complaint.location}</Text>
        </View>

        <View style={styles.descBlock}>
          <Text style={styles.infoLabel}>Description</Text>
          <Text style={styles.descText}>{complaint.description}</Text>
        </View>

        {complaint.imageUrl ? (
          <View style={styles.imageBlock}>
            <View style={styles.imageHeaderRow}>
              <Text style={styles.infoLabel}>Attached Photo Evidence</Text>
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

      {/* AI Intelligence & Explainability Card */}
      <Card style={styles.aiCard}>
        <View style={styles.aiHeaderRow}>
          <View style={styles.aiTitleGroup}>
            <Text style={styles.aiBadge}>AI TRIAGE</Text>
            <Text style={styles.aiCardTitle}>Explainability Engine</Text>
          </View>
          {analyzingAi ? (
            <Text style={styles.aiRunning}>Analyzing…</Text>
          ) : (
            <Text style={styles.aiModelText}>
              {aiAnalysis?.modelUsed || "sentence-transformers"}
            </Text>
          )}
        </View>

        {aiAnalysis ? (
          <View style={styles.aiBody}>
            {/* Urgency Score Progress */}
            <View style={styles.aiMetricRow}>
              <Text style={styles.aiMetricLabel}>Urgency Score</Text>
              <Text style={styles.aiMetricValue}>
                {Math.round(aiAnalysis.urgencyScore * 100)}%
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, Math.round(aiAnalysis.urgencyScore * 100))}%`,
                    backgroundColor:
                      aiAnalysis.urgencyScore > 0.75
                        ? Colors.danger
                        : aiAnalysis.urgencyScore > 0.45
                        ? "#f59e0b"
                        : Colors.success,
                  },
                ]}
              />
            </View>

            <View style={styles.aiGrid}>
              <View style={styles.aiGridItem}>
                <Text style={styles.aiLabelSmall}>Detected Category</Text>
                <Text style={styles.aiValueHighlight}>
                  {aiAnalysis.category.toUpperCase()} (
                  {Math.round(aiAnalysis.categoryConfidence * 100)}%)
                </Text>
              </View>

              <View style={styles.aiGridItem}>
                <Text style={styles.aiLabelSmall}>Suggested Priority</Text>
                <Text style={styles.aiValueHighlight}>
                  {aiAnalysis.priority.toUpperCase()}
                </Text>
              </View>
            </View>

            {aiAnalysis.departmentHint ? (
              <View style={styles.aiInfoRow}>
                <Text style={styles.aiLabelSmall}>Department Routing Suggestion</Text>
                <Text style={styles.aiDeptSuggest}>
                  {aiAnalysis.departmentHint} {aiAnalysis.departmentCode ? `(${aiAnalysis.departmentCode})` : ""}
                </Text>
              </View>
            ) : null}

            <View style={styles.reasoningBox}>
              <Text style={styles.reasoningTitle}>Priority Reasoning</Text>
              <Text style={styles.reasoningText}>{aiAnalysis.reasoning}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.aiPendingText}>
            AI explainability data being processed by backend intelligence…
          </Text>
        )}
      </Card>

      {/* Admin Triage & Actions Panel */}
      <Card style={styles.triageCard}>
        <Text style={styles.sectionHeader}>Admin Triage Controls</Text>

        {/* Status Selection */}
        <Text style={styles.fieldLabel}>Workflow Status</Text>
        <View style={styles.chipGrid}>
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = selectedStatus === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => setSelectedStatus(opt.value)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Priority Selection */}
        <Text style={styles.fieldLabel}>Incident Priority</Text>
        <View style={styles.priorityGrid}>
          {PRIORITY_OPTIONS.map((p) => {
            const isSelected = selectedPriority === p.value;
            return (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.priorityButton,
                  isSelected && { backgroundColor: p.color, borderColor: p.color },
                ]}
                onPress={() => setSelectedPriority(p.value)}
              >
                <Text
                  style={[
                    styles.priorityBtnText,
                    isSelected && { color: Colors.white, fontWeight: "700" },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Department Assignment */}
        <Text style={styles.fieldLabel}>Assigned Department</Text>
        <TouchableOpacity
          style={styles.deptSelector}
          onPress={() => setShowDeptModal(true)}
        >
          <View>
            <Text style={styles.deptSelectorLabel}>
              {assignedDept
                ? `${assignedDept.name} (${assignedDept.code})`
                : "Select Department…"}
            </Text>
            {assignedDept?.head ? (
              <Text style={styles.deptSelectorSub}>Head: {assignedDept.head}</Text>
            ) : null}
          </View>
          <Text style={styles.deptChevron}>▼</Text>
        </TouchableOpacity>

        {/* Workflow Action Note */}
        <TextInput
          label="Triage / Resolution Note"
          placeholder="e.g. Dispatched facility team to replace valve."
          value={triageNote}
          onChangeText={setTriageNote}
          multiline
          numberOfLines={3}
          style={styles.noteInput}
        />

        {/* Save Button */}
        <Button
          title={submitting ? "Saving Triage Updates…" : "Apply Triage Updates"}
          onPress={handleApplyTriage}
          loading={submitting}
          style={styles.submitBtn}
        />
      </Card>

      {/* Status History Timeline */}
      <Card>
        <Text style={styles.sectionHeader}>
          Status Audit Trail ({complaint.updates?.length || 0})
        </Text>

        {!complaint.updates || complaint.updates.length === 0 ? (
          <Text style={styles.noUpdates}>No historical workflow transitions recorded yet.</Text>
        ) : (
          complaint.updates.map((up, idx) => (
            <View key={idx} style={styles.timelineItem}>
              <View style={styles.timelinePoint}>
                <View style={styles.timelineDot} />
                {idx < complaint.updates.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>

              <View style={styles.timelineContent}>
                <View style={styles.timelineHeader}>
                  <StatusBadge status={up.status} />
                  <Text style={styles.timelineTime}>
                    {new Date(up.at).toLocaleDateString()}{" "}
                    {new Date(up.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                <Text style={styles.timelineNote}>{up.note}</Text>
                <Text style={styles.timelineActor}>Updated by: {up.actor}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Bottom Return Navigation Actions */}
      <View style={styles.bottomActions}>
        <Button
          title="← Back to Triage List"
          variant="outline"
          onPress={() => router.replace("/(admin)/complaints")}
          style={styles.backBtn}
        />
        <Button
          title="← Operations Console"
          variant="secondary"
          onPress={() => router.replace("/(admin)/dashboard")}
          style={styles.consoleBtn}
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

      {/* Department Picker Modal */}
      <Modal visible={showDeptModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Department</Text>
              <TouchableOpacity onPress={() => setShowDeptModal(false)}>
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {departments.map((dept) => {
                const isSelected = selectedDepartmentId === dept.id;
                return (
                  <TouchableOpacity
                    key={dept.id}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedDepartmentId(dept.id);
                      setShowDeptModal(false);
                    }}
                  >
                    <View>
                      <Text
                        style={[
                          styles.modalItemTitle,
                          isSelected && styles.modalItemTitleSelected,
                        ]}
                      >
                        {dept.name} ({dept.code})
                      </Text>
                      <Text style={styles.modalItemSub}>
                        {dept.head} • {dept.email}
                      </Text>
                    </View>
                    {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  alertSpacing: {
    marginBottom: 12,
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
    fontSize: 15,
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
  // AI Card Styles
  aiCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    marginBottom: 12,
  },
  aiHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  aiTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiBadge: {
    backgroundColor: Colors.brand600,
    color: Colors.white,
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.navy900,
  },
  aiRunning: {
    fontSize: 11,
    color: Colors.brand600,
    fontStyle: "italic",
  },
  aiModelText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  aiBody: {
    marginTop: 4,
  },
  aiMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  aiMetricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navy900,
  },
  aiMetricValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navy900,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  aiGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  aiGridItem: {
    flex: 1,
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiLabelSmall: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  aiValueHighlight: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navy900,
  },
  aiInfoRow: {
    backgroundColor: Colors.white,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  aiDeptSuggest: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.brand700,
    marginTop: 2,
  },
  reasoningBox: {
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reasoningTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 4,
  },
  reasoningText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  aiPendingText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic",
    paddingVertical: 8,
  },
  // Triage Controls
  triageCard: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.brand600,
    borderColor: Colors.brand600,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  priorityGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  priorityBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  deptSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    marginBottom: 12,
  },
  deptSelectorLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.navy900,
  },
  deptSelectorSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  deptChevron: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  noteInput: {
    minHeight: 65,
    marginBottom: 12,
  },
  submitBtn: {
    marginTop: 6,
  },
  // Timeline
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.brand600,
  },
  modalList: {
    marginBottom: 16,
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalItemSelected: {
    backgroundColor: "#eff6ff",
    borderRadius: 6,
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.navy900,
  },
  modalItemTitleSelected: {
    color: Colors.brand700,
  },
  modalItemSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.brand600,
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
  consoleBtn: {
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
