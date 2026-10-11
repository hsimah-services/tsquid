import { useCallback, useEffect, useRef } from 'react';
import { useMutation, type UseMutationConfig } from 'react-relay';
import type { GraphQLTaggedNode, MutationParameters } from 'relay-runtime';

export function useMutationAction<T extends MutationParameters>(mutation: GraphQLTaggedNode): [
  (config: Omit<UseMutationConfig<T>, 'onCompleted' | 'onError'>) => Promise<T['response']>,
  boolean,
] {
  const [commitMutation, isPending] = useMutation<T>(mutation);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const commit = useCallback((config: Omit<UseMutationConfig<T>, 'onCompleted' | 'onError'>) => new Promise<T['response']>((resolve, reject) => {
    if (!mounted.current) return;
    commitMutation({
      ...config,
      onCompleted: (response, errors) => {
        if (!mounted.current) return;
        if (errors?.length) reject(new Error(errors.map(error => error.message).join(' ')));
        else resolve(response);
      },
      onError: error => { if (mounted.current) reject(error); },
    });
  }), [commitMutation]);
  return [commit, isPending];
}
