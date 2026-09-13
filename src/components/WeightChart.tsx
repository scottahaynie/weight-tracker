import { Circle, matchFont } from "@shopify/react-native-skia";
import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View, useColorScheme } from "react-native";
import { runOnJS, useAnimatedReaction } from "react-native-reanimated";
import { CartesianChart, Line, useChartPressState } from "victory-native";
import { WeightEntry } from "../types";
import { fromISODateString } from "../utils/date";

const LINE_COLOR = "#3B82F6";
const CHART_HEIGHT = 240;

type Props = {
  entries: WeightEntry[];
  height?: number;
};

type ChartPoint = {
  timestamp: number;
  weight: number;
};

function formatShortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function formatShortDateWithYear(date: Date): string {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "numeric", day: "numeric" });
}

// A continuous numeric x-scale (timestamp) lets victory-native place tick
// labels at "nice" positions via d3, independent of how many raw points
// there are — unlike a per-point categorical axis, which starves label
// boxes of space once there are more than a couple dozen entries.
export function WeightChart({ entries, height = CHART_HEIGHT }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const textColor = isDark ? "#E5E7EB" : "#374151";
  const gridColor = isDark ? "#374151" : "#E5E7EB";
  // matchFont's default fontFamily ("System") isn't a name Android's Skia
  // font manager recognizes, so labels silently fail to render there —
  // "sans-serif" is a generic family Android always resolves to Roboto.
  const font = matchFont({
    fontSize: 11,
    ...(Platform.OS === "android" ? { fontFamily: "sans-serif" } : null),
  });

  const chartData: ChartPoint[] = useMemo(
    () =>
      entries.map((e) => ({
        timestamp: fromISODateString(e.date).getTime(),
        weight: e.weight,
      })),
    [entries]
  );

  const { state, isActive } = useChartPressState({ x: 0, y: { weight: 0 } });
  const [activeEntry, setActiveEntry] = useState<WeightEntry | null>(null);

  useAnimatedReaction(
    () => state.matchedIndex.value,
    (idx) => {
      if (idx >= 0 && idx < entries.length) {
        runOnJS(setActiveEntry)(entries[idx]);
      }
    },
    [entries]
  );

  if (entries.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={{ color: textColor }}>No entries in this range yet.</Text>
      </View>
    );
  }

  const weights = entries.map((e) => e.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const padding = Math.max(2, (maxWeight - minWeight) * 0.1);

  return (
    <View style={styles.container}>
      <View style={styles.readout}>
        {isActive && activeEntry ? (
          <Text style={[styles.readoutText, { color: textColor }]}>
            {formatShortDateWithYear(fromISODateString(activeEntry.date))} · {activeEntry.weight.toFixed(1)}
          </Text>
        ) : null}
      </View>

      <View style={[styles.chartArea, { height }]}>
        <CartesianChart
          data={chartData}
          xKey="timestamp"
          yKeys={["weight"]}
          domain={{ y: [minWeight - padding, maxWeight + padding] }}
          chartPressState={state}
          chartPressConfig={{
            // Requires a press-and-hold before the pointer engages, so a
            // plain drag still scrolls the parent ScrollView instead of
            // fighting it.
            pan: { activateAfterLongPress: 300 },
          }}
          axisOptions={{
            font,
            labelColor: textColor,
            lineColor: gridColor,
            tickCount: { x: 5, y: 4 },
            formatXLabel: (ms) => formatShortDate(new Date(ms)),
            formatYLabel: (v) => `${Math.round(v)}`,
          }}
        >
          {({ points }) => (
            <>
              <Line
                points={points.weight}
                color={LINE_COLOR}
                strokeWidth={2}
                curveType="monotoneX"
                animate={{ type: "timing", duration: 300 }}
              />
              {isActive && (
                <Circle
                  cx={state.x.position}
                  cy={state.y.weight.position}
                  r={5}
                  color={LINE_COLOR}
                />
              )}
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  chartArea: {
    width: "100%",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  readout: {
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  readoutText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
