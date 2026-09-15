import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { apiFetch } from "../api/client.js";

const FRESH_MS = 30_000;
const MAX_ENTRIES = 40;
const AdminQueryContext = createContext(null);

// This cache belongs to one mounted administration session. No private data is
// persisted in browser storage or shared with another authenticated account.
function createStore() {
  const entries = new Map();
  const publish = (entry, patch) => {
    entry.state = { ...entry.state, ...patch };
    entry.listeners.forEach(listener => listener());
  };
  function cancel(entry) {
    entry.request = null;
    entry.controller?.abort();
    entry.controller = null;
    if (entry.state.loading) publish(entry, { loading: false });
  }
  function invalidate(prefix) {
    for (const [path, entry] of entries) {
      if (path.startsWith(prefix)) {
        cancel(entry);
        publish(entry, { updatedAt: 0 });
      }
    }
  }
  function rejectAccess(error) {
    for (const entry of entries.values()) {
      cancel(entry);
      publish(entry, { data: null, updatedAt: 0, error: error.message, errorDetails: error });
    }
  }
  function get(path) {
    if (entries.has(path)) return entries.get(path);
    const entry = {
      state: { data: null, loading: false, error: "", errorDetails: null, updatedAt: 0 },
      listeners: new Set(), request: null, controller: null,
    };
    entry.snapshot = () => entry.state;
    entry.subscribe = listener => {
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
        // React StrictMode immediately subscribes again. Defer cancellation so
        // it shares the original request instead of sending it twice.
        queueMicrotask(() => { if (!entry.listeners.size) cancel(entry); });
      };
    };
    entries.set(path, entry);
    return entry;
  }
  function load(path, entry, { timeoutMs = 20000, validate } = {}, force = false) {
    if (entry.request) return entry.request;
    if (!force && entry.state.data !== null && Date.now() - entry.state.updatedAt < FRESH_MS) return Promise.resolve(entry.state.data);
    const controller = new AbortController();
    entry.controller = controller;
    publish(entry, { loading: true, error: "", errorDetails: null });
    const request = Promise.resolve().then(() => apiFetch(path, { signal: controller.signal, timeoutMs }))
      .then(data => {
        if (validate?.(data) === false || data === null || data === undefined) throw new Error("La réponse des données est incomplète. Réessaie dans quelques instants.");
        if (entry.request === request) publish(entry, { data, updatedAt: Date.now(), error: "", errorDetails: null });
        return data;
      })
      .catch(error => {
        if (entry.request === request) {
          if (error.status === 401 || error.status === 403) {
            // A rejected session must not leave snapshots from other pages visible.
            rejectAccess(error);
          } else publish(entry, { error: error.message || "Impossible de charger les données.", errorDetails: error });
        }
        throw error;
      })
      .finally(() => {
        if (entry.request === request) {
          entry.request = null;
          publish(entry, { loading: false });
        }
        // Bound searches and pagination history without evicting visible data.
        for (const [key, candidate] of entries) {
          if (entries.size <= MAX_ENTRIES) break;
          if (!candidate.request && !candidate.listeners.size) entries.delete(key);
        }
      });
    entry.request = request;
    return request;
  }
  return { get, load, invalidate, rejectAccess };
}

export function AdminQueryProvider({ children }) {
  const [store] = useState(createStore);
  return React.createElement(AdminQueryContext.Provider, { value: store }, children);
}

export function useInvalidateAdminQueries() {
  const store = useContext(AdminQueryContext);
  return useCallback(prefix => store?.invalidate(prefix), [store]);
}

export function useAdminMutation() {
  const store = useContext(AdminQueryContext);
  return useCallback(async (path, options) => {
    try {
      return await apiFetch(path, options);
    } catch (error) {
      if (error.status === 401 || error.status === 403) store?.rejectAccess(error);
      throw error;
    }
  }, [store]);
}

export function useAdminQuery(path, { timeoutMs = 20000, validate } = {}) {
  const shared = useContext(AdminQueryContext);
  const [local] = useState(createStore);
  const store = shared || local;
  const entry = useMemo(() => store.get(path), [store, path]);
  const state = useSyncExternalStore(entry.subscribe, entry.snapshot, entry.snapshot);
  useEffect(() => {
    void store.load(path, entry, { timeoutMs, validate }).catch(() => {});
  }, [store, entry, path, timeoutMs, validate]);
  const refresh = useCallback(() => store.load(path, entry, { timeoutMs, validate }, true), [store, entry, path, timeoutMs, validate]);
  const invalidate = useCallback((prefix = path) => store.invalidate(prefix), [store, path]);
  return { ...state, loading: state.loading || (state.data === null && !state.error), refresh, invalidate };
}
