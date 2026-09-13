import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RangeOption } from "../types";

type Props = {
  value: RangeOption;
  onChange: (value: RangeOption) => void;
};

const OPTIONS: { label: string; value: RangeOption }[] = [
  { label: "3 mo", value: "3m" },
  { label: "12 mo", value: "12m" },
  { label: "All", value: "all" },
];

export function RangeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.button, selected && styles.buttonSelected]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.buttonText, selected && styles.buttonTextSelected]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  buttonSelected: {
    backgroundColor: "#3B82F6",
  },
  buttonText: {
    fontSize: 14,
    color: "#374151",
  },
  buttonTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
