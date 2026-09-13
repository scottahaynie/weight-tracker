import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { SyncStatus } from "../hooks/useWeightData";

type Props = {
  status: SyncStatus;
  onPressError: () => void;
};

// A small, easy-to-miss-by-design indicator: writes are optimistic and
// should normally be invisible, so this only draws attention when there's
// actually something to look at (a sync in flight, or one that failed).
export function SyncIndicator({ status, onPressError }: Props) {
  if (status === "idle") return null;

  if (status === "syncing") {
    return (
      <View style={styles.wrapper}>
        <ActivityIndicator size="small" color="#9CA3AF" />
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.wrapper}
      onPress={onPressError}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.errorDot} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  errorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DC2626",
  },
});
