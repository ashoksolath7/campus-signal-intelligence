import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Colors } from "../../theme/colors";

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const getBackgroundColor = () => {
    if (disabled || loading) return "#94a3b8";
    switch (variant) {
      case "secondary":
        return Colors.navy900;
      case "outline":
      case "ghost":
        return "transparent";
      case "danger":
        return Colors.danger;
      case "primary":
      default:
        return Colors.brand600;
    }
  };

  const getTextColor = () => {
    if (disabled && variant === "outline") return "#94a3b8";
    switch (variant) {
      case "outline":
      case "ghost":
        return Colors.navy900;
      case "primary":
      case "secondary":
      case "danger":
      default:
        return Colors.white;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        variant === "outline" && styles.outline,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? Colors.brand600 : Colors.white} size="small" />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  text: {
    fontSize: 15,
    fontWeight: "600",
  },
});

