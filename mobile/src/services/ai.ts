import { api } from "./api";
import type {
  AIClassifyResult,
  AIDuplicateDetectResult,
  SuggestedDuplicateGroup,
} from "../types/domain";

export async function classifyComplaintApi(input: {
  title: string;
  description: string;
  location?: string;
}): Promise<AIClassifyResult> {
  const response = await api.post<AIClassifyResult>("/ai/classify", input);
  return response.data;
}

export async function detectDuplicatesApi(input: {
  title: string;
  description?: string;
  category?: string;
  location?: string;
  threshold?: number;
  limit?: number;
}): Promise<AIDuplicateDetectResult> {
  const response = await api.post<AIDuplicateDetectResult>("/ai/detect-duplicates", input);
  return response.data;
}

export async function getSuggestedDuplicatesApi(): Promise<{
  suggestedGroups: SuggestedDuplicateGroup[];
  totalCandidates: number;
  engine: string;
}> {
  const response = await api.get<{
    suggestedGroups: SuggestedDuplicateGroup[];
    totalCandidates: number;
    engine: string;
  }>("/ai/suggested-duplicates");
  return response.data;
}

