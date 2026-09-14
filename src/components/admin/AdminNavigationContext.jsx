import { createContext, useContext, useEffect } from "react";

export const AdminNavigationContext = createContext(null);

// Editors retain their protection when their navigation is supplied by the shell.
export function useAdminNavigationGuard({ dirty = false, disabled = false } = {}) {
  const setGuard = useContext(AdminNavigationContext);
  useEffect(() => {
    setGuard?.({ dirty, disabled });
    return () => setGuard?.({ dirty: false, disabled: false });
  }, [setGuard, dirty, disabled]);
}
