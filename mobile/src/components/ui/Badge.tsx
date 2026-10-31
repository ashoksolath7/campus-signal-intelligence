import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../theme/colors";
import type { ComplaintStatus, Priority } from "../../types/domain";

type BadgeProps = {
  label: string;
  bg?: string;
  textColor?: string;
};

export function Badge({ label, bg = Colors.brand100, textColor = Colors.brand700 }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  const conf = Colors.status[status] || { bg: "#f1f5f9", text: "#475569", label: status };
  return <Badge label={conf.label} bg={conf.bg} textColor={conf.text} />;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const conf = Colors.priority[priority] || { bg: "#f1f5f9", text: "#475569", label: priority };
  return <Badge label={conf.label} bg={conf.bg} textColor={conf.text} />;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

