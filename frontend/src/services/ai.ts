import { api } from "./api";
import type { Category, Priority } from "../types/domain";

export type AIClassifyResult = {
  category: Category;
  categoryConfidence?: number;
  categoryReasons?: string[];
  priority: Priority;
  priorityReasons?: string[];
  urgencyScore: number;
  summary: string;
  reasoning: string;
  departmentHint?: string;
  departmentCode?: string;
  departmentReasoning?: string;
  modelUsed: string;
};

export type DuplicateMatch = {
  complaintId: string;
  ticket: string;
  title: string;
  category: Category;
  status: string;
  priority: Priority;
  similarityScore: number;
  denseSimilarity?: number;
  duplicateGroupId?: string;
  matchingKeywords: string[];
  summary: string;
  evidence?: string;
  engine?: string;
};

export type AIDuplicateDetectResult = {
  matches: DuplicateMatch[];
  hasDuplicates: boolean;
  topSimilarity: number;
  engine: string;
};

export type SuggestedDuplicateGroup = {
  groupId: string;
  primaryTicket: string;
  primaryId: string;
  memberTickets: string[];
  memberIds: string[];
  commonTheme: string;
  averageSimilarity: number;
  evidence?: string;
  engine?: string;
};

export type AISuggestedDuplicatesResult = {
  suggestedGroups: SuggestedDuplicateGroup[];
  totalCandidates: number;
  engine: string;
};

export async function classifyComplaintApi(payload: {
  title: string;
  description: string;
  location?: string;
}): Promise<AIClassifyResult> {
  try {
    const response = await api.post<AIClassifyResult>("/api/v1/ai/classify", payload);
    return response.data;
  } catch {
    // Resilient fallback for preview mode / offline
    const text = `${payload.title} ${payload.description}`.toLowerCase();
    let category: Category = "facilities";
    let priority: Priority = "medium";
    let urgencyScore = 0.5;

    if (text.includes("wifi") || text.includes("internet") || text.includes("network") || text.includes("portal")) {
      category = "it";
    } else if (text.includes("fire") || text.includes("shock") || text.includes("wire") || text.includes("hazard")) {
      category = "safety";
      priority = "critical";
      urgencyScore = 0.95;
    } else if (text.includes("hostel") || text.includes("mess") || text.includes("food") || text.includes("dorm")) {
      category = "hostel";
    } else if (text.includes("bus") || text.includes("shuttle") || text.includes("cab")) {
      category = "transport";
    } else if (text.includes("exam") || text.includes("grade") || text.includes("class")) {
      category = "academics";
    }

    return {
      category,
      categoryConfidence: 0.60,
      categoryReasons: [`Keyword match in local fallback triage`],
      priority,
      priorityReasons: [`Rule-based priority assignment`],
      urgencyScore,
      summary: `${priority.toUpperCase()} priority ${category}: ${payload.title}`,
      reasoning: "Local preview rule-based fallback triage.",
      departmentHint: "Estate & Facilities Office",
      departmentCode: "FAC",
      departmentReasoning: "Defaulted to facilities in fallback mode.",
      modelUsed: "domain-heuristic-engine (rule-based fallback)",
    };
  }
}

export async function detectDuplicatesApi(payload: {
  title: string;
  description: string;
  category?: string;
  location?: string;
  threshold?: number;
}): Promise<AIDuplicateDetectResult> {
  try {
    const response = await api.post<AIDuplicateDetectResult>("/api/v1/ai/detect-duplicates", payload);
    return response.data;
  } catch {
    return {
      matches: [],
      hasDuplicates: false,
      topSimilarity: 0,
      engine: "preview-fallback",
    };
  }
}

export async function getSuggestedDuplicatesApi(threshold: number = 0.55): Promise<AISuggestedDuplicatesResult> {
  try {
    const response = await api.get<AISuggestedDuplicatesResult>("/api/v1/ai/suggested-duplicates", {
      params: { threshold },
    });
    return response.data;
  } catch {
    return {
      suggestedGroups: [],
      totalCandidates: 0,
      engine: "preview-fallback",
    };
  }
}
