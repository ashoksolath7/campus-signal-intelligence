import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Platform,
} from "react-native";
import {
  getDepartmentsApi,
  createDepartmentApi,
  updateDepartmentApi,
} from "../../src/services/departments";
import { getAnalyticsApi } from "../../src/services/analytics";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { TextInput } from "../../src/components/ui/TextInput";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type { Department, AnalyticsSummary } from "../../src/types/domain";

export default function DepartmentManagementScreen() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newHead, setNewHead] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setFeedback(null);
      const [depts, stats] = await Promise.all([
        getDepartmentsApi(),
        getAnalyticsApi().catch(() => null),
      ]);
      setDepartments(depts);
      setAnalytics(stats);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load departments.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleToggleStatus = async (dept: Department) => {
    try {
      setTogglingId(dept.id);
      setFeedback(null);
      const updated = await updateDepartmentApi(dept.id, { active: !dept.active });
      setDepartments((prev) => prev.map((d) => (d.id === dept.id ? updated : d)));
      setFeedback({
        type: "success",
        text: `${dept.name} status updated to ${updated.active ? "Active" : "Inactive"}.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to toggle department status.",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreateDepartment = async () => {
    if (!newName.trim() || !newCode.trim() || !newHead.trim() || !newEmail.trim()) {
      setModalError("All fields (Name, Code, Head, Email) are required.");
      return;
    }

    try {
      setCreating(true);
      setModalError(null);
      const created = await createDepartmentApi({
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        head: newHead.trim(),
        email: newEmail.trim().toLowerCase(),
        active: true,
      });

      setDepartments((prev) => [...prev, created]);
      setShowCreateModal(false);
      setNewName("");
      setNewCode("");
      setNewHead("");
      setNewEmail("");
      setFeedback({
        type: "success",
        text: `Department ${created.name} (${created.code}) created successfully.`,
      });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to create department.");
    } finally {
      setCreating(false);
    }
  };

  const getWorkload = (deptId: string): number => {
    if (!analytics?.departmentDistribution) return 0;
    const item = analytics.departmentDistribution.find((d) => d.departmentId === deptId);
    return item ? item.count : 0;
  };

  if (loading) {
    return <LoadingSpinner message="Fetching campus departments…" />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand600]} />
      }
    >
      {/* Top Action Bar */}
      <Card style={styles.topBarCard}>
        <View style={styles.topBarRow}>
          <View>
            <Text style={styles.topBarTitle}>Routing Directory</Text>
            <Text style={styles.topBarSub}>
              {departments.filter((d) => d.active).length} Active / {departments.length} Total
              Departments
            </Text>
          </View>
          <Button
            title="+ New Department"
            onPress={() => {
              setModalError(null);
              setShowCreateModal(true);
            }}
            style={styles.newDeptBtn}
          />
        </View>
      </Card>

      {/* Global Feedback */}
      {feedback ? (
        <View style={styles.alertSpacing}>
          <Alert tone={feedback.type}>{feedback.text}</Alert>
        </View>
      ) : null}

      {/* Department Cards */}
      {departments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏢</Text>
          <Text style={styles.emptyTitle}>No Departments Found</Text>
          <Text style={styles.emptyDesc}>
            No campus departments are registered in the system yet.
          </Text>
        </View>
      ) : (
        departments.map((dept) => {
          const workload = getWorkload(dept.id);
          const isToggling = togglingId === dept.id;

          return (
            <Card key={dept.id} style={styles.deptCard}>
              <View style={styles.cardHeader}>
                <View style={styles.titleCodeGroup}>
                  <Text style={styles.deptCodeBadge}>{dept.code}</Text>
                  <Text style={styles.deptName}>{dept.name}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    dept.active ? styles.statusPillActive : styles.statusPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      dept.active ? styles.statusTextActive : styles.statusTextInactive,
                    ]}
                  >
                    {dept.active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Department Head</Text>
                  <Text style={styles.detailValue}>{dept.head}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Direct Contact</Text>
                  <Text style={styles.detailValue}>{dept.email}</Text>
                </View>
              </View>

              <View style={styles.footerRow}>
                <View style={styles.workloadPill}>
                  <Text style={styles.workloadIcon}>📊</Text>
                  <Text style={styles.workloadText}>{workload} Active Tickets Assigned</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.toggleBtn,
                    dept.active ? styles.toggleBtnDeactivate : styles.toggleBtnActivate,
                  ]}
                  onPress={() => handleToggleStatus(dept)}
                  disabled={isToggling}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      dept.active ? styles.toggleTextDeactivate : styles.toggleTextActivate,
                    ]}
                  >
                    {isToggling ? "Updating…" : dept.active ? "Deactivate" : "Activate"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        })
      )}

      {/* Add Department Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Campus Department</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!creating) setShowCreateModal(false);
                }}
              >
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {modalError ? (
                <View style={styles.modalAlert}>
                  <Alert tone="error">{modalError}</Alert>
                </View>
              ) : null}

              <TextInput
                label="Department Name"
                placeholder="e.g. Campus Facilities & Maintenance"
                value={newName}
                onChangeText={setNewName}
              />

              <TextInput
                label="Department Code"
                placeholder="e.g. FAC"
                value={newCode}
                onChangeText={setNewCode}
                autoCapitalize="characters"
              />

              <TextInput
                label="Department Head"
                placeholder="e.g. Dr. Arthur Vance"
                value={newHead}
                onChangeText={setNewHead}
              />

              <TextInput
                label="Official Email"
                placeholder="e.g. facilities@campus.edu"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Button
                title={creating ? "Creating Department…" : "Save Department"}
                onPress={handleCreateDepartment}
                loading={creating}
                style={styles.modalSaveBtn}
              />
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
  topBarCard: {
    backgroundColor: Colors.white,
    marginBottom: 12,
  },
  topBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
  },
  topBarSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  newDeptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  alertSpacing: {
    marginBottom: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
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
  deptCard: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  titleCodeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  deptCodeBadge: {
    backgroundColor: Colors.navy900,
    color: Colors.white,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  deptName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.navy900,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusPillActive: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  statusPillInactive: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusTextActive: {
    color: "#059669",
  },
  statusTextInactive: {
    color: "#dc2626",
  },
  detailGrid: {
    marginBottom: 10,
    gap: 6,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  workloadPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  workloadIcon: {
    fontSize: 12,
  },
  workloadText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
  },
  toggleBtnDeactivate: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff5f5",
  },
  toggleBtnActivate: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  toggleTextDeactivate: {
    color: "#b91c1c",
  },
  toggleTextActivate: {
    color: "#15803d",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
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
  modalCancel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  modalBody: {
    marginBottom: 16,
  },
  modalAlert: {
    marginBottom: 10,
  },
  modalSaveBtn: {
    marginTop: 12,
    marginBottom: 20,
  },
});

