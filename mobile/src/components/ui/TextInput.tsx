import React from "react";
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
} from "react-native";
import { Colors } from "../../theme/colors";

type TextInputProps = RNTextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  rightAction?: React.ReactNode;
};

export function TextInput({
  label,
  error,
  helperText,
  rightAction,
  style,
  ...props
}: TextInputProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          props.multiline && styles.inputWrapperMultiline,
          Boolean(error) && styles.inputError,
        ]}
      >
        <RNTextInput
          placeholderTextColor={Colors.textMuted}
          textAlignVertical={props.multiline ? "top" : "center"}
          style={[styles.input, props.multiline && styles.inputMultiline, style]}
          {...props}
        />
        {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
  },
  inputWrapperMultiline: {
    alignItems: "flex-start",
    paddingVertical: 8,
    minHeight: 90,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerBg,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    height: "auto",
    minHeight: 74,
  },
  rightAction: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});

