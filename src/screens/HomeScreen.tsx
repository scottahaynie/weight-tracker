import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { AddEntryModal } from "../components/AddEntryModal";
import { EntryListModal } from "../components/EntryListModal";
import { RangeSelector } from "../components/RangeSelector";
import { SyncIndicator } from "../components/SyncIndicator";
import { WeightChart } from "../components/WeightChart";
import { useWeightData } from "../hooks/useWeightData";
import { WeightEntry } from "../types";

export function HomeScreen() {
  const {
    entries,
    allEntries,
    latestWeight,
    range,
    setRange,
    loading,
    error,
    refresh,
    submitEntry,
    removeEntry,
    syncStatus,
    failedWrite,
    retryFailedWrite,
    discardFailedWrite,
  } = useWeightData();
  const [modalVisible, setModalVisible] = useState(false);
  const [listVisible, setListVisible] = useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  // Rotated phones are short on vertical room, so the chart gets whatever
  // height is left after the (compacted) chrome above it rather than a
  // fixed value — its width already grows for free since it fills the row.
  const chartHeight = isLandscape ? Math.min(220, Math.max(140, height - 170)) : undefined;

  const handleSubmit = async (entry: WeightEntry) => {
    await submitEntry(entry);
    setModalVisible(false);
  };

  const handleSyncErrorPress = () => {
    if (!failedWrite) return;
    Alert.alert("Sync failed", `${failedWrite.description}\n\n${failedWrite.error}`, [
      { text: "Discard", style: "destructive", onPress: discardFailedWrite },
      { text: "Retry", onPress: retryFailedWrite },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && styles.scrollContentLandscape,
        ]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {isLandscape ? (
          <View style={styles.landscapeHeaderRow}>
            <View style={styles.titleGroup}>
              <Text style={styles.headerCompact}>Nolan's Weight Tracker</Text>
              <SyncIndicator status={syncStatus} onPressError={handleSyncErrorPress} />
            </View>
            <RangeSelector value={range} onChange={setRange} />
          </View>
        ) : (
          <>
            <View style={[styles.titleGroup, styles.titleGroupPortrait]}>
              <Text style={styles.header}>Nolan's Weight Tracker</Text>
              <SyncIndicator status={syncStatus} onPressError={handleSyncErrorPress} />
            </View>
            <View style={styles.rangeSelector}>
              <RangeSelector value={range} onChange={setRange} />
            </View>
          </>
        )}

        {/* Chart */}
        {loading && entries.length === 0 ? (
          <ActivityIndicator style={styles.loader} size="large" />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <WeightChart entries={entries} height={chartHeight} />
        )}
      </ScrollView>

      {/* Renders before the FABs below so they stay on top and stay tappable
          (this panel stops above them, but JSX order also controls stacking). */}
      <EntryListModal
        visible={listVisible}
        entries={allEntries}
        onClose={() => setListVisible(false)}
        onDelete={removeEntry}
      />

      {/* List button */}
      <TouchableOpacity
        style={[styles.fab, styles.fabLeft]}
        onPress={() => setListVisible((v) => !v)}
      >
        <View style={styles.listIcon}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.listIconRow}>
              <View style={styles.listIconDot} />
              <View style={styles.listIconLine} />
            </View>
          ))}
        </View>
      </TouchableOpacity>

      {/* Add button */}
      <TouchableOpacity style={[styles.fab, styles.fabRight]} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <AddEntryModal
        visible={modalVisible}
        defaultWeight={latestWeight}
        onCancel={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  scrollContentLandscape: {
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: "700",
  },
  headerCompact: {
    fontSize: 16,
    fontWeight: "700",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleGroupPortrait: {
    marginBottom: 16,
  },
  landscapeHeaderRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  rangeSelector: {
    marginBottom: 20,
  },
  loader: {
    marginTop: 60,
  },
  error: {
    color: "#DC2626",
    marginTop: 40,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 32,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabLeft: {
    left: 24,
  },
  fabRight: {
    right: 24,
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "400",
    lineHeight: 34,
  },
  listIcon: {
    gap: 5,
  },
  listIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  listIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  listIconLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#FFFFFF",
  },
});
