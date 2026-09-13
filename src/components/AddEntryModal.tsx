import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { formatDisplayDate, toISODateString } from "../utils/date";

const DEFAULT_WEIGHT = 75.0;
const WEIGHT_STEP = 0.1;
// Gaining weight is the goal here, so above the last entry reads green,
// below reads red — intensity ramps up to this many lbs of difference.
const MAX_DELTA_FOR_FULL_INTENSITY = 5;
const NEUTRAL_RGB: [number, number, number] = [255, 255, 255];
const GAIN_RGB: [number, number, number] = [22, 163, 74]; // green-600
const LOSS_RGB: [number, number, number] = [220, 38, 38]; // red-600

function lerpRgb(from: [number, number, number], to: [number, number, number], t: number): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function weightBackgroundColor(weight: number, lastWeight: number | undefined): string {
  if (lastWeight === undefined || Number.isNaN(weight) || weight === lastWeight) {
    return "#FFFFFF";
  }
  const delta = weight - lastWeight;
  const intensity = Math.min(Math.abs(delta) / MAX_DELTA_FOR_FULL_INTENSITY, 1);
  return lerpRgb(NEUTRAL_RGB, delta > 0 ? GAIN_RGB : LOSS_RGB, intensity);
}

type Props = {
  visible: boolean;
  defaultWeight?: number;
  onCancel: () => void;
  onSubmit: (entry: { date: string; weight: number }) => Promise<void>;
};

// Avoids float drift (e.g. 75.1 + 0.1 === 75.19999999999999).
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const HOLD_INITIAL_DELAY_MS = 400;
const HOLD_REPEAT_INTERVAL_MS = 80;

// Fires `action` once immediately on press, then repeatedly while held.
function useHoldRepeat(action: () => void) {
  const actionRef = useRef(action);
  actionRef.current = action;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    actionRef.current();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => actionRef.current(), HOLD_REPEAT_INTERVAL_MS);
    }, HOLD_INITIAL_DELAY_MS);
  }, []);

  useEffect(() => stop, [stop]);

  return { onPressIn: start, onPressOut: stop };
}

export function AddEntryModal({ visible, defaultWeight, onCancel, onSubmit }: Props) {
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weightText, setWeightText] = useState((defaultWeight ?? DEFAULT_WEIGHT).toFixed(1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to the latest recorded weight + today's date each time the modal opens.
  useEffect(() => {
    if (visible) {
      setWeightText((defaultWeight ?? DEFAULT_WEIGHT).toFixed(1));
      setDate(new Date());
      setShowDatePicker(false);
      setError(null);
    }
  }, [visible, defaultWeight]);

  const adjustWeight = (delta: number) => {
    setWeightText((prevText) => {
      const current = parseFloat(prevText);
      const base = Number.isNaN(current) ? (defaultWeight ?? DEFAULT_WEIGHT) : current;
      return round1(base + delta).toFixed(1);
    });
  };

  const parsedWeight = parseFloat(weightText);
  const inputBackgroundColor = weightBackgroundColor(parsedWeight, defaultWeight);
  const intensity =
    defaultWeight !== undefined && !Number.isNaN(parsedWeight)
      ? Math.min(Math.abs(parsedWeight - defaultWeight) / MAX_DELTA_FOR_FULL_INTENSITY, 1)
      : 0;

  const adjustDate = (deltaDays: number) => {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + deltaDays);
      return next > new Date() ? prev : next;
    });
  };

  const decDateHold = useHoldRepeat(() => adjustDate(-1));
  const incDateHold = useHoldRepeat(() => adjustDate(1));
  const decWeightHold = useHoldRepeat(() => adjustWeight(-WEIGHT_STEP));
  const incWeightHold = useHoldRepeat(() => adjustWeight(WEIGHT_STEP));

  const handleSave = async () => {
    const weight = parseFloat(weightText);
    if (Number.isNaN(weight) || weight <= 0) {
      setError("Enter a valid weight");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ date: toISODateString(date), weight });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel} disabled={saving}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Add Weight</Text>

          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.stepButton}
              onPressIn={decDateHold.onPressIn}
              onPressOut={decDateHold.onPressOut}
              disabled={saving}
            >
              <Text style={styles.stepButtonText}>−</Text>
            </TouchableOpacity>
            <Pressable
              style={styles.dateDisplay}
              onPress={() => setShowDatePicker((v) => !v)}
              disabled={saving}
            >
              <Text style={styles.dateValue}>{formatDisplayDate(date)}</Text>
            </Pressable>
            <TouchableOpacity
              style={styles.stepButton}
              onPressIn={incDateHold.onPressIn}
              onPressOut={incDateHold.onPressOut}
              disabled={saving}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onValueChange={(_event, selectedDate) => {
                setDate(selectedDate);
                // Android shows this as a dialog with its own OK button, which
                // closes the native picker — keep our state in sync. iOS's
                // spinner has no such button; it stays open until the date
                // field is tapped again.
                if (Platform.OS === "android") setShowDatePicker(false);
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          )}

          <View style={styles.weightRow}>
            <TouchableOpacity
              style={styles.stepButton}
              onPressIn={decWeightHold.onPressIn}
              onPressOut={decWeightHold.onPressOut}
              disabled={saving}
            >
              <Text style={styles.stepButtonText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={[
                styles.weightInput,
                { backgroundColor: inputBackgroundColor, color: intensity > 0.5 ? "#FFFFFF" : "#111827" },
              ]}
              keyboardType="decimal-pad"
              placeholder="Weight (lbs)"
              value={weightText}
              onChangeText={setWeightText}
              textAlign="center"
            />
            <TouchableOpacity
              style={styles.stepButton}
              onPressIn={incWeightHold.onPressIn}
              onPressOut={incWeightHold.onPressOut}
              disabled={saving}
            >
              <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  dateDisplay: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  stepButtonText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#374151",
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 24,
  },
  error: {
    color: "#DC2626",
    fontSize: 13,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelText: {
    color: "#6B7280",
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: "#3B82F6",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: "center",
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
