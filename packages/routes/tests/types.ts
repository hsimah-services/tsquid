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


// Generated entrypoint hooks return a union narrowed by the generated enum.
import { RouteName, useTutorialRouteContext } from './routes.generated';
function RouteContextConsumer() {
  const route = useTutorialRouteContext();
  if (route.currentRoute === RouteName.TutorialDetail) {
    const id: string = route.input.id;
    route.updateURI({ id });
    // @ts-expect-error Detail routes do not own a filter field.
    route.updateURI({ filter: 'turn' });
  } else {
    const filter: string | undefined = route.input.filter;
    route.updateURI({ filter });
    // @ts-expect-error The filter is a string, not a number.
    route.updateURI({ filter: 123 });
    // @ts-expect-error List routes do not have a required path id.
    route.input.id;
  }
  // @ts-expect-error This entrypoint cannot be the Playlists route.
  const playlist: RouteName.Playlists = route.currentRoute;
  void playlist;
  return null;
}
void RouteContextConsumer;


import { defineRoute } from '../runtime/entrypoint';
import { TutorialsURI, TutorialsRouteContext } from './routes.generated';
// @ts-expect-error URI helpers cannot update routes; use the active context.
TutorialsURI.updateURI('/tutorials', { filter: 'turn' });
const tutorialRoute = defineRoute({
  uri: TutorialsURI,
  context: TutorialsRouteContext,
  getRouteType: () => ({}),
  entryPoint,
});
// @ts-expect-error Route definitions cannot update routes either.
tutorialRoute.updateURI('/tutorials', { filter: 'turn' });
