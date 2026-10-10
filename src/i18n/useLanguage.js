import { useSyncExternalStore } from "react";
import { getLanguage, subscribeLanguage } from "./locale.js";

const serverLanguage = () => "fr";

export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, serverLanguage);
}
