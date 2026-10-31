import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const memoryStore: Record<string, string> = {};

export async function saveSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      } else {
        memoryStore[key] = value;
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    memoryStore[key] = value;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStore[key] ?? null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    return memoryStore[key] ?? null;
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      delete memoryStore[key];
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    delete memoryStore[key];
  }
}

