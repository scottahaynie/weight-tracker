import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WeightEntry } from "../types";
import { fromISODateString } from "../utils/date";

type Props = {
  visible: boolean;
  entries: WeightEntry[];
  onClose: () => void;
  onDelete: (entry: WeightEntry) => Promise<void>;
};

function entryKey(entry: WeightEntry): string {
  return `${entry.date}-${entry.weight}`;
}

function formatRowDate(iso: string): string {
  return fromISODateString(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EntryListModal({ visible, entries, onClose, onDelete }: Props) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries]
  );

  const handleDelete = (entry: WeightEntry) => {
    Alert.alert(
      "Delete entry?",
      `Remove ${formatRowDate(entry.date)} — ${entry.weight.toFixed(1)} lbs?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const key = entryKey(entry);
            setDeletingKey(key);
            try {
              await onDelete(entry);
            } catch (err) {
              Alert.alert("Failed to delete", err instanceof Error ? err.message : "Unknown error");
            } finally {
              setDeletingKey(null);
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>All Entries</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={entryKey}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No entries yet.</Text>}
        renderItem={({ item }) => {
          const isDeleting = deletingKey === entryKey(item);
          return (
            <View style={styles.row}>
              <Text style={styles.rowDate}>{formatRowDate(item.date)}</Text>
              <Text style={styles.rowWeight}>{item.weight.toFixed(1)}</Text>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Text style={styles.deleteIcon}>🗑</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Stops above the FAB row (rather than covering the full screen) so the
  // List button stays visible and can toggle this panel closed again.
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 110,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  doneText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3B82F6",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  rowDate: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  rowWeight: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    minWidth: 50,
    textAlign: "right",
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteIcon: {
    fontSize: 18,
  },
  empty: {
    marginTop: 40,
    textAlign: "center",
    color: "#6B7280",
    fontSize: 15,
  },
});
