import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../../theme/colors";

type AlertProps = {
  children: React.ReactNode;
  tone?: "info" | "success" | "warning" | "error";
};

export function Alert({ children, tone = "info" }: AlertProps) {
  const getColors = () => {
    switch (tone) {
      case "success":
        return { bg: Colors.successBg, border: Colors.successBorder, text: Colors.success };
      case "warning":
        return { bg: Colors.warningBg, border: Colors.warningBorder, text: Colors.warning };
      case "error":
        return { bg: Colors.dangerBg, border: Colors.dangerBorder, text: Colors.danger };
      case "info":
      default:
        return { bg: Colors.infoBg, border: Colors.infoBorder, text: Colors.info };
    }
  };

  const c = getColors();

  return (
    <View style={[styles.alert, { backgroundColor: c.bg, borderColor: c.border }]}>
      {typeof children === "string" ? (
        <Text style={[styles.text, { color: c.text }]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  alert: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
});

