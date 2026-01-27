import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";

type AppButtonVariant = "primary" | "secondary" | "ghost";

type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
};

const VARIANT_STYLES: Record<AppButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: "#111",
    borderColor: "#111"
  },
  secondary: {
    backgroundColor: "#fff",
    borderColor: "#ddd"
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent"
  }
};

export function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  fullWidth = true
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        VARIANT_STYLES[variant],
        fullWidth ? styles.fullWidth : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "primary" ? styles.textPrimary : styles.textSecondary,
          disabled ? styles.textDisabled : null
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  fullWidth: {
    width: "100%"
  },
  text: {
    fontSize: 15,
    fontWeight: "600"
  },
  textPrimary: {
    color: "#fff"
  },
  textSecondary: {
    color: "#111"
  },
  textDisabled: {
    color: "#aaa"
  },
  pressed: {
    opacity: 0.85
  },
  disabled: {
    backgroundColor: "#f2f2f2",
    borderColor: "#eee"
  }
});
