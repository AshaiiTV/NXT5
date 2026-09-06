import React from "react";
import { Button, Surface } from "../ui/Core.jsx";

export function MatchPaginationNotice({ data, loading, loadingMore, loadMore, refreshAll }) {
  const loaded = data.matches?.length || 0;
  const total = Number(data.pagination?.total || 0);
  if (!data.pagination?.hasMore && loaded >= total) return null;
  return <Surface className="mb-4"><div className="flex flex-wrap items-center justify-between gap-3">
    <div><p className="text-sm font-black text-white">Analyses sur {loaded} des {total} games</p><p className="mt-1 text-xs text-slate-300">Les statistiques et tendances ci-dessous portent sur les games chargées de cette équipe.</p></div>
    <div className="flex gap-2">{data.pagination?.hasMore ? <><Button type="button" variant="ghost" disabled={loadingMore || loading} onClick={() => loadMore()}>{loadingMore ? "Chargement…" : "Charger la suite"}</Button><Button type="button" disabled={loadingMore || loading} onClick={() => loadMore({ all: true })}>Charger toutes les games</Button></> : <Button type="button" disabled={loading} onClick={() => refreshAll()}>Actualiser les games</Button>}</div>
  </div></Surface>;
}
