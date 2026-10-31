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
import { useRouter } from "expo-router";
import { getComplaintsApi } from "../../src/services/complaints";
import { getDepartmentsApi } from "../../src/services/departments";
import { Card } from "../../src/components/ui/Card";
import { TextInput } from "../../src/components/ui/TextInput";
import { Button } from "../../src/components/ui/Button";
import { PriorityBadge, StatusBadge, Badge } from "../../src/components/ui/Badge";
import { LoadingSpinner } from "../../src/components/ui/LoadingSpinner";
import { Alert } from "../../src/components/ui/Alert";
import { Colors } from "../../src/theme/colors";
import type { Complaint, Department, ComplaintStatus, Priority, Category } from "../../src/types/domain";

const STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All Status" },
  { id: "submitted", label: "Submitted" },
  { id: "in_review", label: "In Review" },
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All Priority" },
  { id: "critical", label: "Critical" },
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

const CATEGORY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All Categories" },
  { id: "facilities", label: "Facilities" },
  { id: "academics", label: "Academics" },
  { id: "hostel", label: "Hostel" },
  { id: "it", label: "IT" },
  { id: "safety", label: "Safety" },
  { id: "transport", label: "Transport" },
  { id: "other", label: "Other" },
];

export default function AdminComplaintsScreen() {
  const router = useRouter();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDeptId, setSelectedDeptId] = useState("all");
  const [deptModalVisible, setDeptModalVisible] = useState(false);

  const fetchComplaints = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [complaintsData, deptsData] = await Promise.all([
        getComplaintsApi({
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          priority: selectedPriority !== "all" ? selectedPriority : undefined,
          category: selectedCategory !== "all" ? selectedCategory : undefined,
          search: searchQuery.trim() || undefined,
        }),
        getDepartmentsApi(),
      ]);

      let filtered = complaintsData;
      if (selectedDeptId !== "all") {
        filtered = filtered.filter((c) => c.departmentId === selectedDeptId);
      }

      setComplaints(filtered);
      setDepartments(deptsData);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to fetch complaints from backend. Pull down to retry.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, selectedPriority, selectedCategory, selectedDeptId, searchQuery]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchComplaints();
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSelectedPriority("all");
    setSelectedCategory("all");
    setSelectedDeptId("all");
  };

  const selectedDeptName =
    selectedDeptId === "all"
      ? "All Departments"
      : departments.find((d) => d.id === selectedDeptId)?.name || "Department";

  return (
    <View style={styles.container}>
      {/* Top Filter Controls */}
      <View style={styles.filterSection}>
        <TextInput
          placeholder="Search by ticket #, title, location, student…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />

        {/* Status Horizontal Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setSelectedStatus(opt.id)}
              style={[styles.chip, selectedStatus === opt.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, selectedStatus === opt.id && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Priority & Department Secondary Row */}
        <View style={styles.secondaryFilterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.priorityScroll}>
            {PRIORITY_OPTIONS.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setSelectedPriority(p.id)}
                style={[styles.subChip, selectedPriority === p.id && styles.subChipActive]}
              >
                <Text style={[styles.subChipText, selectedPriority === p.id && styles.subChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={styles.deptBtn}
            onPress={() => setDeptModalVisible(true)}
          >
            <Text style={styles.deptBtnText} numberOfLines={1}>
              🏢 {selectedDeptName} ▾
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Horizontal Filter Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORY_OPTIONS.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setSelectedCategory(c.id)}
              style={[styles.categoryChip, selectedCategory === c.id && styles.categoryChipActive]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === c.id && styles.categoryChipTextActive,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Alert tone="error">{errorMessage}</Alert>
          <Button
            title="Retry Connection"
            variant="outline"
            onPress={fetchComplaints}
            style={styles.retryBtn}
          />
        </View>
      ) : null}

      {/* Complaints Feed */}
      {loading ? (
        <LoadingSpinner message="Fetching campus complaints…" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand600]} />}
        >
          <View style={styles.listHeaderRow}>
            <Text style={styles.resultsCount}>
              {complaints.length} ticket{complaints.length === 1 ? "" : "s"} found
            </Text>
            {(selectedStatus !== "all" || selectedPriority !== "all" || selectedCategory !== "all" || selectedDeptId !== "all" || searchQuery.trim()) ? (
              <TouchableOpacity onPress={resetFilters}>
                <Text style={styles.clearFiltersText}>Reset filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {complaints.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No matching complaints</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search terms, status, priority, or department filters.
              </Text>
              <Button title="Reset All Filters" variant="outline" onPress={resetFilters} style={styles.resetBtn} />
            </Card>
          ) : (
            complaints.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => router.push(`/(admin)/${item.id}` as any)}
              >
                <Card>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.ticketNumber}>{item.ticket}</Text>
                    <View style={styles.badges}>
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                    </View>
                  </View>

                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>

                  {item.duplicateGroupId ? (
                    <View style={styles.dupBadge}>
                      <Text style={styles.dupBadgeText}>🔗 Duplicate Group: {item.duplicateGroupId}</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <Text style={styles.footerMeta}>👤 {item.studentName}</Text>
                    <Text style={styles.footerMeta}>📍 {item.location}</Text>
                    <Text style={styles.footerMeta}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Department Selector Modal */}
      <Modal visible={deptModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Filter by Department</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={true}>
              <TouchableOpacity
                style={[styles.modalItem, selectedDeptId === "all" && styles.modalItemActive]}
                onPress={() => {
                  setSelectedDeptId("all");
                  setDeptModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    selectedDeptId === "all" && styles.modalItemTextActive,
                  ]}
                >
                  All Departments
                </Text>
              </TouchableOpacity>

              {departments.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.modalItem, selectedDeptId === d.id && styles.modalItemActive]}
                  onPress={() => {
                    setSelectedDeptId(d.id);
                    setDeptModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedDeptId === d.id && styles.modalItemTextActive,
                    ]}
                  >
                    {d.name} ({d.code})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Button
              title="Close"
              variant="outline"
              onPress={() => setDeptModalVisible(false)}
              style={styles.modalCloseBtn}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterSection: {
    backgroundColor: Colors.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    marginRight: 6,
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
    fontWeight: "700",
  },
  secondaryFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  priorityScroll: {
    flex: 1,
  },
  subChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.background,
    marginRight: 6,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  subChipActive: {
    backgroundColor: Colors.navy800,
    borderColor: Colors.navy800,
  },
  subChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  subChipTextActive: {
    color: Colors.white,
  },
  deptBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 140,
  },
  deptBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.navy900,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  clearFiltersText: {
    fontSize: 12,
    color: Colors.brand600,
    fontWeight: "700",
  },
  cardTopRow: {
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
  badges: {
    flexDirection: "row",
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  dupBadge: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  dupBadgeText: {
    fontSize: 11,
    color: "#1e40af",
    fontWeight: "600",
  },
  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 4,
  },
  footerMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
    marginTop: 10,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
    lineHeight: 18,
  },
  resetBtn: {
    paddingHorizontal: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "75%",
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
    marginBottom: 16,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalItemActive: {
    backgroundColor: Colors.brand50,
  },
  modalItemText: {
    fontSize: 14,
    color: Colors.navy900,
    fontWeight: "500",
  },
  modalItemTextActive: {
    color: Colors.brand600,
    fontWeight: "700",
  },
  modalCloseBtn: {
    marginTop: 16,
  },
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 6,
  },
  categoryChipActive: {
    backgroundColor: Colors.brand50,
    borderColor: Colors.brand600,
  },
  categoryChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: Colors.brand600,
    fontWeight: "700",
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  retryBtn: {
    marginTop: 6,
  },
});
