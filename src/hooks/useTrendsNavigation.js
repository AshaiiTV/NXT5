import { useEffect, useRef, useState } from "react";
import { readTrendsRoute, trendsPath } from "../app/trends-navigation.js";

const readLocation = () => readTrendsRoute(typeof window === "undefined" ? {} : { path: window.location.pathname, search: window.location.search });

export function useTrendsNavigation(selectedTeamId) {
  const [selection, setSelection] = useState(readLocation);
  const current = useRef(selection);
  current.current = selection;
  const previousTeam = useRef(selectedTeamId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      current.current = readLocation();
      setSelection(current.current);
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  const updateSelection = (changes, { replace = true } = {}) => {
    const next = { ...current.current, ...changes };
    current.current = next;
    setSelection(next);
    if (typeof window !== "undefined") {
      window.history[replace ? "replaceState" : "pushState"]({}, "", trendsPath(next));
      window.dispatchEvent(new Event("popstate"));
    }
  };

  useEffect(() => {
    if (previousTeam.current !== selectedTeamId) {
      const hadTeam = Boolean(previousTeam.current);
      previousTeam.current = selectedTeamId;
      if (hadTeam) updateSelection({ category: "", period: "all" });
    }
  }, [selectedTeamId]);

  const onNavigate = (event, detail = "") => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    updateSelection({ detail, panel: "draft" }, { replace: false });
  };

  return {
    ...selection,
    setCategory: (category) => updateSelection({ category }),
    setPeriod: (period) => updateSelection({ period }),
    resetFilters: () => updateSelection({ category: "", period: "all" }),
    setPanel: (panel) => updateSelection({ panel, detail: "" }),
    detailHref: (detail) => trendsPath({ ...selection, panel: "draft", detail }),
    onNavigate,
  };
}
