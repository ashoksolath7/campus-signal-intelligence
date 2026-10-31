import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../src/components/ui/Button";
import { Colors } from "../../src/theme/colors";

export default function OnboardingScreen() {
  const router = useRouter();

  const features = [
    {
      title: "Fast Complaint Reporting",
      desc: "Report campus maintenance, safety, academic, or facility issues instantly with photo evidence.",
      tag: "STEP 1",
    },
    {
      title: "AI-Powered Intelligence",
      desc: "Our neural triage classifies your issue, assigns appropriate department, and predicts urgency.",
      tag: "STEP 2",
    },
    {
      title: "Transparent Lifecycle Tracking",
      desc: "Follow the live status timeline of your complaints from submission through resolution.",
      tag: "STEP 3",
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⚡</Text>
          </View>
          <Text style={styles.title}>Campus Signal Intelligence</Text>
          <Text style={styles.subtitle}>
            Empowering students and campus administration with AI-driven operations.
          </Text>
        </View>

        <View style={styles.featureList}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{f.tag}</Text>
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        <Button
          title="Get Started"
          onPress={() => router.replace("/(auth)/login")}
          style={styles.btn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navy900,
  },
  scroll: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  hero: {
    alignItems: "center",
    marginBottom: 36,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.brand600,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.white,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: Colors.brand100,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.85,
  },
  featureList: {
    gap: 14,
    marginBottom: 32,
  },
  featureCard: {
    backgroundColor: Colors.navy800,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.navy700,
    padding: 16,
  },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: Colors.brand600,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.white,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.white,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 13,
    color: Colors.brand100,
    lineHeight: 18,
    opacity: 0.8,
  },
  btn: {
    backgroundColor: Colors.brand500,
    height: 52,
  },
});

