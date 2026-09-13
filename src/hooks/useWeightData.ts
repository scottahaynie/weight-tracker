import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { addEntry, deleteEntry, fetchEntries } from "../api/sheets";
import { RangeOption, WeightEntry } from "../types";

const RANGE_MONTHS: Record<Exclude<RangeOption, "all">, number> = {
  "3m": 3,
  "12m": 12,
};

// Other clients can be editing the same sheet, so data more than this old is
// treated as possibly stale and worth a background refetch on foreground.
const AUTO_REFRESH_INTERVAL_MS = 1 * 60 * 1000;

function filterByRange(entries: WeightEntry[], range: RangeOption): WeightEntry[] {
  if (range === "all") return entries;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RANGE_MONTHS[range]);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return entries.filter((e) => e.date >= cutoffStr);
}

function sortEntries(entries: WeightEntry[]): WeightEntry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

function sameEntry(a: WeightEntry, b: WeightEntry): boolean {
  return a.date === b.date && Math.abs(a.weight - b.weight) < 0.001;
}

type QueueOp = {
  id: string;
  type: "add" | "delete";
  entry: WeightEntry;
  status: "pending" | "syncing" | "failed";
  error?: string;
};

function withStatus(op: QueueOp, status: QueueOp["status"], error?: string): QueueOp {
  return { ...op, status, error };
}

let nextOpId = 0;
function makeOpId(): string {
  return `${Date.now()}-${nextOpId++}`;
}

export type SyncStatus = "idle" | "syncing" | "error";

export type FailedWrite = {
  description: string;
  error: string;
};

// Add/delete are queued and applied to the UI optimistically instead of
// blocking on the Apps Script round trip (which typically takes ~2s
// regardless of how little work the script does). The queue is processed
// strictly one item at a time — two writes racing against the same sheet is
// how you'd get a delete matching the wrong row — and a failure pauses the
// queue rather than retrying automatically, surfaced via `syncStatus`.
export function useWeightData() {
  const [allEntries, setAllEntries] = useState<WeightEntry[]>([]);
  const [range, setRange] = useState<RangeOption>("3m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueOp[]>([]);
  // queueRef is the actual source of truth for the processing loop below —
  // state updates aren't guaranteed to be visible between the awaits in
  // processQueue, so the loop reads/writes this synchronously and mirrors it
  // into `queue` state (via syncQueueState) purely for rendering.
  const queueRef = useRef<QueueOp[]>([]);
  const processingRef = useRef(false);
  // Timestamp of the last successful fetch, checked against on every
  // foreground transition to decide whether the data might be stale.
  const lastFetchedAtRef = useRef<number | null>(null);

  const syncQueueState = useCallback(() => {
    setQueue([...queueRef.current]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await fetchEntries();
      setAllEntries(entries);
      lastFetchedAtRef.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState !== "active") return;
      const lastFetchedAt = lastFetchedAtRef.current;
      if (lastFetchedAt === null || Date.now() - lastFetchedAt > AUTO_REFRESH_INTERVAL_MS) {
        load();
      }
    });
    return () => subscription.remove();
  }, [load]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0 && queueRef.current[0].status !== "failed") {
        const head = queueRef.current[0];
        queueRef.current = queueRef.current.map((op) =>
          op.id === head.id ? withStatus(op, "syncing") : op
        );
        syncQueueState();
        try {
          if (head.type === "add") {
            await addEntry(head.entry);
            setAllEntries((prev) => sortEntries([...prev, head.entry]));
          } else {
            await deleteEntry(head.entry);
            setAllEntries((prev) => prev.filter((e) => !sameEntry(e, head.entry)));
          }
          queueRef.current = queueRef.current.filter((op) => op.id !== head.id);
          syncQueueState();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to sync";
          queueRef.current = queueRef.current.map((op) =>
            op.id === head.id ? withStatus(op, "failed", message) : op
          );
          syncQueueState();
          break;
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [syncQueueState]);

  const enqueue = useCallback(
    (op: QueueOp) => {
      queueRef.current = [...queueRef.current, op];
      syncQueueState();
      processQueue();
    },
    [processQueue, syncQueueState]
  );

  const submitEntry = useCallback(
    async (entry: WeightEntry) => {
      enqueue({ id: makeOpId(), type: "add", entry, status: "pending" });
    },
    [enqueue]
  );

  const removeEntry = useCallback(
    async (entry: WeightEntry) => {
      // Still sitting unsent in the queue — drop it locally, there's
      // nothing on the sheet yet to delete.
      const pendingAdd = queueRef.current.find(
        (op) => op.type === "add" && op.status === "pending" && sameEntry(op.entry, entry)
      );
      if (pendingAdd) {
        queueRef.current = queueRef.current.filter((op) => op.id !== pendingAdd.id);
        syncQueueState();
        return;
      }
      enqueue({ id: makeOpId(), type: "delete", entry, status: "pending" });
    },
    [enqueue, syncQueueState]
  );

  const retryFailedWrite = useCallback(() => {
    const failed = queueRef.current.find((op) => op.status === "failed");
    if (!failed) return;
    queueRef.current = queueRef.current.map((op) =>
      op.id === failed.id ? withStatus(op, "pending") : op
    );
    syncQueueState();
    processQueue();
  }, [processQueue, syncQueueState]);

  const discardFailedWrite = useCallback(() => {
    const failed = queueRef.current.find((op) => op.status === "failed");
    if (!failed) return;
    queueRef.current = queueRef.current.filter((op) => op.id !== failed.id);
    syncQueueState();
    processQueue();
  }, [processQueue, syncQueueState]);

  // Entries as they should appear right now: server truth with any in-flight
  // (pending/syncing) writes applied on top. A failed write is excluded here
  // — it reverts to server truth until the user retries or discards it via
  // the sync indicator, rather than leaving an unconfirmed change on screen.
  const displayedEntries = useMemo(() => {
    const active = queue.filter((op) => op.status !== "failed");
    const withoutDeleted = allEntries.filter(
      (e) => !active.some((op) => op.type === "delete" && sameEntry(op.entry, e))
    );
    const pendingAdds = active.filter((op) => op.type === "add").map((op) => op.entry);
    return sortEntries([...withoutDeleted, ...pendingAdds]);
  }, [allEntries, queue]);

  const filteredEntries = useMemo(
    () => filterByRange(displayedEntries, range),
    [displayedEntries, range]
  );
  // displayedEntries is sorted ascending by date, so the last item is the most recent.
  const latestWeight =
    displayedEntries.length > 0 ? displayedEntries[displayedEntries.length - 1].weight : undefined;

  const failedOp = queue.find((op) => op.status === "failed");
  const syncStatus: SyncStatus = failedOp ? "error" : queue.length > 0 ? "syncing" : "idle";
  const failedWrite: FailedWrite | null = failedOp
    ? {
        description:
          failedOp.type === "add"
            ? `Add ${failedOp.entry.date} · ${failedOp.entry.weight.toFixed(1)}`
            : `Delete ${failedOp.entry.date} · ${failedOp.entry.weight.toFixed(1)}`,
        error: failedOp.error ?? "Unknown error",
      }
    : null;

  return {
    entries: filteredEntries,
    allEntries: displayedEntries,
    latestWeight,
    range,
    setRange,
    loading,
    error,
    refresh: load,
    submitEntry,
    removeEntry,
    syncStatus,
    failedWrite,
    retryFailedWrite,
    discardFailedWrite,
  };
}
