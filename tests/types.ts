import type { EntryPointProps, RouteEntryPoint } from '../runtime/entrypoint';
import type { PreloadedQuery } from 'react-relay';
import type { ConcreteRequest } from 'relay-runtime';

type Query = { variables: { id: string }; response: { title: string } };
type Queries = { detail?: Query };
type Props = EntryPointProps<Queries, Record<string, never>, Record<string, never>, null>;
declare const request: ConcreteRequest;
function Component(props: Props) {
  const reference: PreloadedQuery<Query> | undefined = props.queries.detail;
  void reference;
  return null;
}
const entryPoint: RouteEntryPoint<{ id?: string }, Queries, Record<string, never>, Record<string, never>, null> = {
  root: { getModuleId: () => 'test', getModuleIfRequired: () => Component, load: async () => Component },
  getPreloadProps: ({ id }) => ({ queries: id ? { detail: { parameters: request, variables: { id } } } : {} }),
};
void entryPoint;
const invalid: RouteEntryPoint<{ id: string }, { detail: Query }, Record<string, never>, Record<string, never>, null> = {
  root: { getModuleId: () => 'test', getModuleIfRequired: () => Component, load: async () => Component },
  // @ts-expect-error Query variables require an id, not a filter.
  getPreloadProps: () => ({ queries: { detail: { parameters: request, variables: { filter: 'x' } } } }),
};
void invalid;
