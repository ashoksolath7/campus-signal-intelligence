import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../src/context/AuthContext";
import { createComplaintApi } from "../../src/services/complaints";
import { getDepartmentsApi } from "../../src/services/departments";
import { classifyComplaintApi, detectDuplicatesApi } from "../../src/services/ai";
import { Button } from "../../src/components/ui/Button";
import { TextInput } from "../../src/components/ui/TextInput";
import { Card } from "../../src/components/ui/Card";
import { Alert } from "../../src/components/ui/Alert";
import { Badge, PriorityBadge } from "../../src/components/ui/Badge";
import { Colors } from "../../src/theme/colors";
import type {
  Category,
  Department,
  AIClassifyResult,
  DuplicateMatch,
} from "../../src/types/domain";

const CATEGORIES: Category[] = [
  "facilities",
  "academics",
  "hostel",
  "it",
  "safety",
  "transport",
  "other",
];

export default function SubmitComplaintScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<Category>("facilities");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // AI Assist State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIClassifyResult | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deptPickerVisible, setDeptPickerVisible] = useState(false);

  useEffect(() => {
    async function loadDepts() {
      try {
        const list = await getDepartmentsApi();
        setDepartments(list);
        if (list.length > 0) {
          setDepartmentId((prev) => prev || list[0].id);
        }
      } catch (err) {
        setErrorMessage("Could not load departments list. Please verify server connection.");
      }
    }
    loadDepts();
  }, []);

  // Gallery Picker
  async function pickFromGallery() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Permission to access photo gallery is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const mime = result.assets[0].mimeType || "image/jpeg";
        setImageUrl(`data:${mime};base64,${result.assets[0].base64}`);
      }
    } catch (err) {
      setErrorMessage("Failed to select image from gallery.");
    }
  }

  // Camera Picker
  async function takePhoto() {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage("Permission to access camera is required.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const mime = result.assets[0].mimeType || "image/jpeg";
        setImageUrl(`data:${mime};base64,${result.assets[0].base64}`);
      }
    } catch (err) {
      setErrorMessage("Failed to capture image with camera.");
    }
  }

  // AI Intelligence Triage & Duplicate Detection
  async function handleAIAssist() {
    if (!title.trim() && !description.trim()) {
      setErrorMessage("Please enter a title or description first before running AI triage.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const [classifyRes, dupRes] = await Promise.all([
        classifyComplaintApi({
          title: title.trim(),
          description: description.trim(),
          location: location.trim() || undefined,
        }),
        detectDuplicatesApi({
          title: title.trim(),
          description: description.trim(),
          category,
          location: location.trim() || undefined,
          threshold: 0.45,
        }),
      ]);

      setAiResult(classifyRes);
      setCategory(classifyRes.category as Category);

      // Auto-select department if match found
      if (classifyRes.departmentHint && departments.length > 0) {
        const hint = classifyRes.departmentHint.toLowerCase();
        const matched = departments.find(
          (d) => d.name.toLowerCase().includes(hint) || hint.includes(d.name.toLowerCase()),
        );
        if (matched) {
          setDepartmentId(matched.id);
        }
      }

      setDuplicateMatches(dupRes.matches || []);
    } catch (err) {
      console.warn("AI Triage error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Submit Complaint
  async function handleSubmit() {
    if (!title.trim()) {
      setErrorMessage("Ticket title is required.");
      return;
    }
    if (!description.trim()) {
      setErrorMessage("Detailed description is required.");
      return;
    }
    if (!location.trim()) {
      setErrorMessage("Location is required.");
      return;
    }
    if (!departmentId) {
      setErrorMessage("Please select a responsible department.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created = await createComplaintApi({
        title: title.trim(),
        description: description.trim(),
        category,
        departmentId,
        location: location.trim(),
        imageUrl: imageUrl || undefined,
      });

      router.replace(`/(student)/${created.id}` as any);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to submit complaint.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedDeptName =
    departments.find((d) => d.id === departmentId)?.name || "Select Department";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Submit a Complaint</Text>
          <Text style={styles.headerSubtitle}>
            Report an issue with automatic AI categorization and department routing.
          </Text>
        </View>

        {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

        {/* Semantic Duplicate Warning */}
        {duplicateMatches.length > 0 ? (
          <View style={styles.dupAlert}>
            <View style={styles.dupHeader}>
              <Text style={styles.dupIcon}>⚠️</Text>
              <Text style={styles.dupTitle}>
                Potential Duplicate Tickets Found ({duplicateMatches.length})
              </Text>
            </View>
            <Text style={styles.dupDesc}>
              Our AI detected similar complaints already reported on campus:
            </Text>
            {duplicateMatches.slice(0, 3).map((match) => (
              <TouchableOpacity
                key={match.complaintId}
                style={styles.dupItem}
                activeOpacity={0.7}
                onPress={() => router.push(`/(student)/${match.complaintId}` as any)}
              >
                <View style={styles.dupItemTop}>
                  <Text style={styles.dupItemTicket}>{match.ticket} — {match.title}</Text>
                  <Text style={styles.dupItemScore}>
                    {Math.round(match.similarityScore * 100)}% match →
                  </Text>
                </View>
                {match.evidence ? (
                  <Text style={styles.dupEvidence}>Evidence: {match.evidence}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
            <Text style={styles.dupNote}>
              You can still submit your complaint if this is a distinct issue.
            </Text>
          </View>
        ) : null}

        {/* AI Triage Banner */}
        {aiResult ? (
          <View style={styles.aiResultCard}>
            <View style={styles.aiResultHeader}>
              <Text style={styles.aiResultTitle}>
                ✨ AI Recommendation: {aiResult.category.toUpperCase()}
              </Text>
              <PriorityBadge priority={aiResult.priority} />
            </View>
            <Text style={styles.aiReasoning}>{aiResult.reasoning}</Text>
            {aiResult.departmentHint ? (
              <Text style={styles.aiDept}>
                Suggested Department: {aiResult.departmentHint}{" "}
                {aiResult.departmentCode ? `(${aiResult.departmentCode})` : ""}
              </Text>
            ) : null}
            {aiResult.priorityReasons && aiResult.priorityReasons.length > 0 ? (
              <Text style={styles.aiPriorityReason}>
                Priority Rationale: {aiResult.priorityReasons.join("; ")}
              </Text>
            ) : null}
            <Text style={styles.aiModel}>Engine: {aiResult.modelUsed}</Text>
          </View>
        ) : null}

        <Card>
          <TextInput
            label="Title *"
            placeholder="e.g. Water leakage on 3rd floor restroom"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            label="Detailed Description *"
            placeholder="Provide context, details, and how long the issue has persisted…"
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            style={styles.textArea}
          />

          <TextInput
            label="Location *"
            placeholder="e.g. Block B, 3rd Floor, Room 304"
            value={location}
            onChangeText={setLocation}
          />

          {/* AI Assist Button */}
          <Button
            title={isAnalyzing ? "AI Analyzing…" : "✨ Run AI Triage & Duplicate Check"}
            variant="outline"
            onPress={handleAIAssist}
            loading={isAnalyzing}
            style={styles.aiBtn}
            textStyle={styles.aiBtnText}
          />

          {/* Category Picker */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Category *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                >
                  <Text
                    style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}
                  >
                    {cat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Department Picker Trigger */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Assigned Department *</Text>
            <TouchableOpacity
              onPress={() => setDeptPickerVisible(true)}
              style={styles.pickerTrigger}
            >
              <Text style={styles.pickerTriggerText}>{selectedDeptName}</Text>
              <Text style={styles.pickerChevron}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Image Attachment (Expo Image Picker) */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Photo / Evidence Attachment (Optional)</Text>
            <View style={styles.imageActions}>
              <Button
                title="📷 Camera"
                variant="outline"
                onPress={takePhoto}
                style={styles.imageActionBtn}
              />
              <Button
                title="🖼️ Gallery"
                variant="outline"
                onPress={pickFromGallery}
                style={styles.imageActionBtn}
              />
              {imageUrl ? (
                <TouchableOpacity onPress={() => setImageUrl(null)} style={styles.removeImageBtn}>
                  <Text style={styles.removeImageText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {imageUrl ? (
              <View style={styles.imagePreviewWrapper}>
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
              </View>
            ) : null}
          </View>

          <View style={styles.actionBtnRow}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => router.back()}
              style={styles.cancelBtn}
            />
            <Button
              title={isSubmitting ? "Submitting to database…" : "Submit Complaint Ticket"}
              onPress={handleSubmit}
              loading={isSubmitting}
              style={styles.submitBtn}
            />
          </View>
        </Card>
      </ScrollView>

      {/* Department Picker Modal */}
      <Modal visible={deptPickerVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Campus Department</Text>
              <TouchableOpacity onPress={() => setDeptPickerVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {departments.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => {
                    setDepartmentId(d.id);
                    setDeptPickerVisible(false);
                  }}
                  style={[styles.modalItem, departmentId === d.id && styles.modalItemActive]}
                >
                  <Text style={[styles.modalItemTitle, departmentId === d.id && styles.modalItemTextActive]}>
                    {d.name} ({d.code})
                  </Text>
                  <Text style={styles.modalItemSub}>{d.head} • {d.email}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.navy900,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  textArea: {
    height: 90,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  aiBtn: {
    borderColor: Colors.brand500,
    backgroundColor: Colors.brand50,
    marginBottom: 14,
  },
  aiBtnText: {
    color: Colors.brand700,
    fontWeight: "700",
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  categoryScroll: {
    flexDirection: "row",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: Colors.navy900,
    borderColor: Colors.navy900,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
  },
  categoryChipTextActive: {
    color: Colors.white,
  },
  pickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    height: 46,
  },
  pickerTriggerText: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  pickerChevron: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  imageActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  imageActionBtn: {
    flex: 1,
    height: 38,
  },
  removeImageBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  removeImageText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  imagePreviewWrapper: {
    marginTop: 10,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imagePreview: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
  },
  actionBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 2,
  },
  dupAlert: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  dupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  dupIcon: {
    fontSize: 16,
  },
  dupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400e",
  },
  dupDesc: {
    fontSize: 12,
    color: "#b45309",
    marginBottom: 8,
  },
  dupItem: {
    backgroundColor: Colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fef3c7",
    padding: 8,
    marginBottom: 6,
  },
  dupItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dupItemTicket: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navy900,
    flex: 1,
  },
  dupItemScore: {
    fontSize: 11,
    fontWeight: "800",
    color: "#b45309",
    marginLeft: 6,
  },
  dupEvidence: {
    fontSize: 11,
    color: "#92400e",
    marginTop: 4,
  },
  dupNote: {
    fontSize: 11,
    color: "#92400e",
    marginTop: 4,
    fontStyle: "italic",
  },
  aiResultCard: {
    backgroundColor: Colors.brand50,
    borderWidth: 1,
    borderColor: Colors.brand100,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  aiResultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  aiResultTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.brand700,
  },
  aiReasoning: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  aiDept: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navy900,
    marginBottom: 2,
  },
  aiPriorityReason: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  aiModel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.navy900,
  },
  modalClose: {
    fontSize: 18,
    color: Colors.textMuted,
    padding: 4,
  },
  modalList: {
    marginTop: 8,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalItemActive: {
    backgroundColor: Colors.brand50,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  modalItemTextActive: {
    color: Colors.brand600,
  },
  modalItemSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

