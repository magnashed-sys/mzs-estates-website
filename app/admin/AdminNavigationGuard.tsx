'use client';

import {createContext, useContext, useEffect, useMemo, useRef, type ReactNode} from 'react';

type Guard = () => boolean;
const NavigationContext = createContext<{canNavigate: Guard; register: (guard: Guard) => () => void}>({
  canNavigate: () => true,
  register: (_guard: Guard): (() => void) => () => {},
});

/** Keep page-specific save/review guards effective in the shared header. */
export function AdminNavigationProvider({children}: {children: ReactNode}) {
  const guards = useRef(new Set<Guard>());
  const value = useMemo(() => ({
    canNavigate: () => [...guards.current].every(guard => guard()),
    register: (guard: Guard) => {
      guards.current.add(guard);
      return () => { guards.current.delete(guard); };
    },
  }), []);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useAdminNavigationGuard(guard: Guard) {
  const {register} = useContext(NavigationContext);
  const current = useRef(guard);
  useEffect(() => { current.current = guard; });
  useEffect(() => register(() => current.current()), [register]);
}

export function useAdminNavigation() {
  return useContext(NavigationContext);
}
