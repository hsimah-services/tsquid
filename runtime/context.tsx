import { createContext, useContext } from 'react';

export function createRouteContext<I>() {
  const Context = createContext<{ input: I; updateURI: (patch: Partial<I>) => string } | null>(null);
  function useRoute() {
    const value = useContext(Context);
    if (!value) throw new Error('Route context used outside its active entrypoint');
    return value;
  }
  return { Context, useRoute };
}
