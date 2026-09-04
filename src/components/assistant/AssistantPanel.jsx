import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BookOpen, Loader2, MessageCircleQuestion, RefreshCw, Send, Trash2, WifiOff, X } from "lucide-react";
import { apiFetch } from "../../api/client.js";
import { isSafeInternalPath } from "../../app/routing.js";
import { cx } from "../../app/helpers.js";

const ROUTE_SUGGESTIONS = [
  { matches: ["/equipes", "/gestion-equipe"], prompts: ["Comment ajouter un joueur ?", "Comment organiser la Main Team et les Subs ?", "Où modifier les accès de l'équipe ?"] },
  { matches: ["/integration"], prompts: ["Comment importer une game ?", "Pourquoi mon import peut-il échouer ?", "Comment ouvrir les statistiques d'une game ?"] },
  { matches: ["/statistiques"], prompts: ["Comment lire les statistiques de cette game ?", "Où comparer les performances par rôle ?", "Comment créer une review depuis cette game ?"] },
  { matches: ["/rapports"], prompts: ["Comment créer une review ?", "Comment lier plusieurs games à une review ?", "Où retrouver mes anciennes reviews ?"] },
  { matches: ["/tendances"], prompts: ["Comment filtrer les tendances ?", "Comment interpréter les indicateurs d'équipe ?", "Comment ouvrir une game source ?"] },
  { matches: ["/planning"], prompts: ["Comment renseigner les disponibilités ?", "Qui peut modifier le planning ?", "Comment préparer une session d'équipe ?"] },
  { matches: ["/draft/pool"], prompts: ["Comment modifier le pool d'un joueur ?", "Comment classer un champion par tier ?", "À quoi servent les statuts des picks ?"] },
  { matches: ["/draft/compositions"], prompts: ["Comment créer une composition ?", "Comment utiliser les tiers du Champion Pool ?", "Comment préparer nos drafts ?"] },
  { matches: ["/mon-profil", "/profil"], prefix: true, prompts: ["Comment choisir le profil observé ?", "Comment lire l'historique d'un joueur ?", "Où retrouver ses champions et matchups ?"] },
];

const DEFAULT_SUGGESTIONS = [
  "Comment utiliser cette page ?",
  "Quelle est la prochaine étape conseillée ?",
  "Où trouver la fonctionnalité que je cherche ?",
];

function messageId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function suggestionsForRoute(path = "") {
  const route = ROUTE_SUGGESTIONS.find((item) => item.matches.some((candidate) => item.prefix ? path === candidate || path.startsWith(`${candidate}/`) : path === candidate));
  return route?.prompts || DEFAULT_SUGGESTIONS;
}

function responseBody(payload) {
  return payload?.data && typeof payload.data === "object" ? payload.data : payload;
}

function assistantText(payload) {
  const body = responseBody(payload);
  const value = body?.answer ?? body?.reply ?? body?.content ?? (typeof body?.message === "string" ? body.message : body?.message?.content);
  return typeof value === "string" ? value.trim() : "";
}

function assistantActions(payload) {
  const actions = responseBody(payload)?.actions;
  if (!Array.isArray(actions)) return [];
  return actions.flatMap((action) => {
    const path = action?.path || action?.href || action?.url || "";
    const label = action?.label || action?.title || "Ouvrir";
    if (!isSafeInternalPath(path) || typeof label !== "string") return [];
    return [{ label: label.trim() || "Ouvrir", path }];
  }).slice(0, 3);
}

function assistantSuggestions(payload) {
  const suggestions = responseBody(payload)?.suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions
    .map((item) => String(item || "").trim().slice(0, 120))
    .filter((item, index, array) => item.length >= 4 && array.indexOf(item) === index)
    .slice(0, 3);
}

function assistantSources(payload) {
  const sources = responseBody(payload)?.sources;
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((source) => {
    const title = String(source?.title || "").trim().slice(0, 80);
    const path = String(source?.path || "").trim();
    if (!title || !isSafeInternalPath(path)) return [];
    return [{ title, path }];
  }).slice(0, 3);
}

function historyPayload(messages) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map((message) => ({ role: message.role, content: message.content }));
}

export default function AssistantPanel({ open, onClose, route, selectedTeamId, selectedEntity = null, initialPrompt = "", navigate }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedMessage, setFailedMessage] = useState("");
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const messagesRef = useRef(messages);
  const previousFocusRef = useRef(null);
  const requestRef = useRef(null);
  const requestVersionRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const routeSuggestions = useMemo(() => suggestionsForRoute(route?.path || ""), [route?.path]);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (open && initialPrompt) setDraft(String(initialPrompt).slice(0, 800));
  }, [open, initialPrompt]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end", behavior: messages.length ? "smooth" : "auto" });
  }, [open, messages, loading, error]);

  useEffect(() => () => {
    requestVersionRef.current += 1;
    requestRef.current?.abort();
  }, []);

  async function requestAnswer(text, { appendUser = true } = {}) {
    const content = String(text || "").trim();
    if (!content || loading) return;
    const currentMessages = messagesRef.current;
    const previousMessages = !appendUser && currentMessages.at(-1)?.role === "user" && currentMessages.at(-1)?.content === content
      ? currentMessages.slice(0, -1)
      : currentMessages;
    if (appendUser) {
      const userMessage = { id: messageId(), role: "user", content };
      setMessages((current) => [...current, userMessage]);
      messagesRef.current = [...currentMessages, userMessage];
      setDraft("");
    }
    setLoading(true);
    setError("");
    setFailedMessage("");
    const requestVersion = ++requestVersionRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await apiFetch("assistant-chat", {
        method: "POST",
        timeoutMs: 30000,
        signal: controller.signal,
        body: JSON.stringify({
          message: content,
          route: route?.path || "/equipes",
          selectedTeamId: selectedTeamId || null,
          selectedEntity: selectedEntity || null,
          history: historyPayload(previousMessages),
        }),
      });
      if (requestVersion !== requestVersionRef.current) return;
      const answer = assistantText(result);
      if (!answer) throw new Error("L'assistant n'a pas renvoyé de réponse lisible.");
      const assistantMessage = {
        id: messageId(),
        role: "assistant",
        content: answer,
        actions: assistantActions(result),
        suggestions: assistantSuggestions(result),
        sources: assistantSources(result),
        fallback: Boolean(responseBody(result)?.fallback),
      };
      setMessages((current) => [...current, assistantMessage]);
      messagesRef.current = [...messagesRef.current, assistantMessage];
    } catch (requestError) {
      if (requestVersion !== requestVersionRef.current) return;
      setError(requestError?.message || "L'assistant est indisponible pour le moment.");
      setFailedMessage(content);
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setLoading(false);
        requestRef.current = null;
      }
    }
  }

  function clearHistory() {
    requestVersionRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    messagesRef.current = [];
    setMessages([]);
    setDraft("");
    setLoading(false);
    setError("");
    setFailedMessage("");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function openInternalPath(path) {
    if (!isSafeInternalPath(path)) return;
    navigate?.(path);
  }

  function submit(event) {
    event?.preventDefault?.();
    requestAnswer(draft);
  }

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] isolate">
      <button type="button" aria-label="Fermer l'assistant" onClick={onClose} className="pointer-events-auto absolute inset-0 cursor-default bg-black/65 backdrop-blur-[3px] sm:hidden" />
      <aside role="dialog" aria-modal="false" aria-labelledby="nxt5-assistant-title" className="nxt5-enter-fast nxt5-panel nxt5-premium-panel pointer-events-auto absolute inset-x-2 bottom-2 isolate flex h-[calc(100dvh-1rem)] flex-col overflow-hidden border border-cyan-200/24 bg-[#030611]/98 text-white shadow-[0_28px_90px_rgba(0,0,0,.82),0_0_42px_rgba(34,211,238,.12)] ring-1 ring-white/10 sm:inset-x-auto sm:bottom-20 sm:right-4 sm:h-[min(42rem,calc(100dvh-6.5rem))] sm:w-[min(28rem,calc(100vw-2rem))] lg:right-6">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-cyan-100/12 bg-[#060a18] px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200/22 bg-cyan-400/10 text-cyan-100"><MessageCircleQuestion className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 id="nxt5-assistant-title" className="truncate text-lg font-black text-white">Assistant NXT5</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">Disponible sur toutes les pages</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={clearHistory} disabled={!messages.length && !error && !loading} aria-label="Effacer la conversation" title="Effacer la conversation" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-4 w-4" /></button>
            <button type="button" onClick={onClose} aria-label="Fermer l'assistant" title="Fermer" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-cyan-200/30 hover:bg-cyan-300/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#040817] px-4 py-5 sm:px-5" aria-live="polite" aria-busy={loading}>
          {!messages.length && !loading && (
            <div className="flex min-h-full flex-col justify-center py-6">
              <MessageCircleQuestion className="h-8 w-8 text-cyan-100" />
              <h3 className="mt-4 text-xl font-black text-white">Que veux-tu faire sur cette page ?</h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-400">Pose une question sur l'utilisation de NXT5 ou choisis un point de départ.</p>
              <div className="mt-6 border-y border-white/10">
                {routeSuggestions.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => requestAnswer(suggestion)} className="group flex w-full items-center justify-between gap-3 border-b border-white/10 px-1 py-3.5 text-left text-sm font-bold leading-5 text-slate-200 transition last:border-b-0 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200/70">
                    <span>{suggestion}</span><ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {!!messages.length && <div className="space-y-5">
            {messages.map((message, index) => (
              <article key={message.id} className={cx("min-w-0", message.role === "user" && "ml-auto max-w-[88%]")}>
                <p className="mb-1.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-slate-500">{message.role === "user" ? "Toi" : "Assistant"}</p>
                <div className={cx("whitespace-pre-wrap break-words text-sm font-semibold leading-6", message.role === "user" ? "rounded-2xl rounded-tr-md border border-cyan-200/20 bg-cyan-400/10 px-4 py-3 text-cyan-50" : "border-l-2 border-cyan-300/55 pl-4 text-slate-200")}>{message.content}</div>
                {!!message.actions?.length && <div className="mt-3 flex flex-wrap gap-2 pl-4">
                  {message.actions.map((action) => <button key={`${message.id}-${action.path}`} type="button" onClick={() => openInternalPath(action.path)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-200/22 bg-cyan-400/10 px-3 py-2 text-left text-xs font-black text-cyan-50 transition hover:border-cyan-200/45 hover:bg-cyan-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"><span>{action.label}</span><ArrowRight className="h-3.5 w-3.5 shrink-0" /></button>)}
                </div>}
                {message.role === "assistant" && (!!message.sources?.length || message.fallback) && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-[0.65rem] font-bold text-slate-500">
                  {message.fallback && <span className="inline-flex items-center gap-1.5 text-amber-100/70"><WifiOff className="h-3 w-3" />Guide local</span>}
                  {!!message.sources?.length && <span className="inline-flex min-w-0 items-center gap-1.5"><BookOpen className="h-3 w-3 shrink-0" /><span className="truncate">{message.sources.map((source) => source.title).join(" · ")}</span></span>}
                </div>}
                {message.role === "assistant" && index === messages.length - 1 && !!message.suggestions?.length && <div className="mt-4 border-t border-white/[0.08] pl-4 pt-2">
                  {message.suggestions.map((suggestion) => <button key={`${message.id}-${suggestion}`} type="button" onClick={() => requestAnswer(suggestion)} className="group flex w-full items-center justify-between gap-3 py-2 text-left text-xs font-bold leading-5 text-slate-400 transition hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"><span>{suggestion}</span><ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" /></button>)}
                </div>}
              </article>
            ))}
          </div>}

          {loading && <div className="mt-5 flex items-center gap-3 border-l-2 border-cyan-300/45 pl-4 text-sm font-semibold text-slate-300"><Loader2 className="h-4 w-4 animate-spin text-cyan-200" /><span>L'assistant prépare une réponse...</span></div>}

          {error && <div role="alert" className="mt-5 flex items-start gap-3 border-l-2 border-amber-300/60 bg-amber-300/[0.055] px-4 py-3 text-amber-50">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold leading-5">{error}</p>{failedMessage && <button type="button" onClick={() => requestAnswer(failedMessage, { appendUser: false })} className="mt-2 inline-flex items-center gap-2 text-xs font-black text-amber-100 underline decoration-amber-200/40 underline-offset-4 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"><RefreshCw className="h-3.5 w-3.5" />Réessayer</button>}</div>
          </div>}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="shrink-0 border-t border-cyan-100/12 bg-[#030612] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pt-4">
          <div className="flex items-end gap-2 rounded-2xl border border-cyan-100/16 bg-[#070c1b] p-2 transition-within focus-within:border-cyan-200/45 focus-within:ring-4 focus-within:ring-cyan-300/10">
            <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(event); } }} rows={2} maxLength={800} disabled={loading} aria-label="Question pour l'assistant NXT5" placeholder="Pose une question sur NXT5" className="max-h-36 min-h-[3rem] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm font-semibold leading-5 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60" />
            <button type="submit" disabled={loading || !draft.trim()} aria-label="Envoyer la question" title="Envoyer" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-200/30 bg-cyan-400/15 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,.10)] transition hover:border-cyan-100/55 hover:bg-cyan-300/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 disabled:cursor-not-allowed disabled:opacity-35">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
          </div>
        </form>
      </aside>
    </div>
  );
}
