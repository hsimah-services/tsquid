import { createContext, useContext, type Context } from 'react';

export type RouteContextValue<I, N extends string> = {
  currentRoute: N;
  input: I;
  updateURI: (patch: Partial<I>) => string;
};

export type RouteContext<I, N extends string> = {
  currentRoute: N;
  Context: Context<RouteContextValue<I, N> | null>;
  useRoute: () => RouteContextValue<I, N>;
};

/** One shared context per generated route catalogue, so the nearest route wins. */
export function createRouteContextRegistry<S extends { currentRoute: string }>() {
  const ActiveRouteContext = createContext<S | null>(null);

  function useRouteContext(): S {
    const value = useContext(ActiveRouteContext);
    if (!value) throw new Error('Route context used outside its active entrypoint');
    return value;
  }

  function forRoute<N extends S['currentRoute']>(currentRoute: N) {
    type State = Extract<S, { currentRoute: N }>;
    function useRoute(): State {
      const value = useRouteContext();
      if (value.currentRoute !== currentRoute) {
        throw new Error(`Expected route ${currentRoute}, but current route is ${value.currentRoute}`);
      }
      // TypeScript cannot narrow a generic discriminated union using a generic N.
      return value as State;
    }
    return {
      currentRoute,
      // The provider accepts only this route's state, while sharing the catalogue's
      // context identity. Consumers validate the discriminator before narrowing.
      Context: ActiveRouteContext as Context<State | null>,
      useRoute,
    };
  }

  return { forRoute, useRouteContext };
}
