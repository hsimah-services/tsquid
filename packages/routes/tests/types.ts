import type { Empty, EntryPointProps, EntryPointPropsOf, RouteEntryPoint } from '../runtime/entrypoint';
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

import { useMutationAction } from '../runtime/mutation';
type SaveMutation = { variables: { name: string }; response: { saved: { id: string } } };
function MutationTypes() {
  const [commit, pending] = useMutationAction<SaveMutation>(request);
  const response: Promise<SaveMutation['response']> = commit({ variables: { name: 'Ada' } });
  const busy: boolean = pending;
  // @ts-expect-error Artifact variables require a name string.
  commit({ variables: { name: 1 } });
  // @ts-expect-error Completion is represented by the returned promise.
  commit({ variables: { name: 'Ada' }, onCompleted: () => {} });
  void [response, busy];
  return null;
}
void MutationTypes;

const defaultEntry: RouteEntryPoint<{ id: string }, { detail: Query }> = {
  root: { getModuleId: () => 'defaults', getModuleIfRequired: () => () => null, load: async () => () => null },
  getPreloadProps: route => ({ queries: { detail: { parameters: request, variables: { id: route.id } } } }),
};
function DefaultProps(props: EntryPointPropsOf<typeof defaultEntry>) {
  const query: PreloadedQuery<Query> = props.queries.detail;
  const nested: Empty = props.entryPoints;
  const passed: Empty = props.props;
  const extra: Empty = props.extraProps;
  // @ts-expect-error Default extraProps cannot hold route fields.
  const bad: typeof extra = { id: '1' };
  void [query, nested, passed, bad];
  return null;
}
function CustomProps(props: EntryPointPropsOf<typeof entryPoint>) {
  const extra: null = props.extraProps;
  const query: PreloadedQuery<Query> | undefined = props.queries.detail;
  void [extra, query];
  return null;
}
void [defaultEntry, DefaultProps, CustomProps];


// Generated entrypoint hooks return a union narrowed by the generated enum.
import { RouteName, TutorialDetailRouteQuery, useTutorialRouteContext } from './routes.generated';
const generatedVariables: { id: string; first?: number; after?: string | null; order?: 'POSITION' } = TutorialDetailRouteQuery.getVariables({ id: '1', order: 'POSITION' as const });
void generatedVariables;
const narrowedEnumVariables: { id: string; order: 'POSITION' | 'TITLE'; first?: number; after?: string | null } = TutorialDetailRouteQuery.getVariables({ id: '1', order: 'TITLE' as const });
void narrowedEnumVariables;
const looseEnumInput: import('./routes.generated').TutorialDetailInputType = { id: '1' };
// @ts-expect-error URL strings must be narrowed before assigning enum query variables.
const looseEnumVariables: { order: 'POSITION' | 'TITLE' } = TutorialDetailRouteQuery.getVariables(looseEnumInput);
void looseEnumVariables;
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
import { TutorialsURI, TutorialsRouteContext, PlaylistsURI, PlaylistsRouteContext, type TutorialEntryPointParams } from './routes.generated';
const sharedEntryPoint: RouteEntryPoint<TutorialEntryPointParams, Queries, Record<string, never>, Record<string, never>, null> = {
  root: entryPoint.root,
  getPreloadProps: route => {
    if (route.currentRoute === RouteName.TutorialDetail) {
      const id: string = route.input.id;
      // @ts-expect-error Detail input has no filter.
      route.input.filter;
      return { queries: { detail: { parameters: request, variables: { id } } } };
    }
    const filter: string | undefined = route.input.filter;
    void filter;
    // @ts-expect-error List input has no id.
    route.input.id;
    return {};
  },
};
const defaultRoute = defineRoute({ uri: TutorialsURI, context: TutorialsRouteContext, entryPoint: sharedEntryPoint });
const defaultParams: { currentRoute: RouteName.Tutorials; input: { filter?: string } } = defaultRoute.useRouteType();
void defaultParams;
// @ts-expect-error Playlist does not belong to the Tutorial entrypoint.
defineRoute({ uri: PlaylistsURI, context: PlaylistsRouteContext, entryPoint: sharedEntryPoint });
// @ts-expect-error URI helpers cannot update routes; use the active context.
TutorialsURI.updateURI('/tutorials', { filter: 'turn' });
const tutorialRoute = defineRoute({
  uri: TutorialsURI,
  context: TutorialsRouteContext,
  getRouteType: (input, currentRoute) => {
    const name: RouteName.Tutorials = currentRoute;
    // @ts-expect-error The current route is the Tutorials literal.
    const wrong: RouteName.TutorialDetail = currentRoute;
    const filter: string | undefined = input.filter;
    void [name, wrong, filter];
    return {};
  },
  entryPoint,
});
// @ts-expect-error Route definitions cannot update routes either.
tutorialRoute.updateURI('/tutorials', { filter: 'turn' });
// @ts-expect-error URI helpers do not expose active route refresh.
TutorialsURI.refresh();
// @ts-expect-error Inactive context definitions do not expose route refresh.
TutorialsRouteContext.refresh();


// Route tests need a case for every route, with the matching definition and required input.
import { renderRoute, testRoutes, type RouteTestCases } from '../runtime/testing';
import { TutorialDetailURI, TutorialDetailRouteContext, type RouteContextType } from './routes.generated';
declare const routeTest: (name: string, fn: () => Promise<void>) => void;
declare const manifest: { routes: { name: string }[] };
const playlistsRoute = defineRoute({ uri: PlaylistsURI, context: PlaylistsRouteContext, entryPoint: { root: entryPoint.root, getPreloadProps: () => ({}) } });
const detailRoute = defineRoute({ uri: TutorialDetailURI, context: TutorialDetailRouteContext, entryPoint: sharedEntryPoint });
const routeName: RouteName.Tutorials = defaultRoute.name;
void routeName;
testRoutes<RouteContextType>(routeTest, manifest, {
  Tutorials: { route: defaultRoute },
  TutorialDetail: { route: detailRoute, input: { id: '1' }, resolvers: { Tutorial: () => ({ title: 'Mocked' }) } },
  Playlists: { route: playlistsRoute },
});
// @ts-expect-error Every route in the catalogue needs a case.
testRoutes<RouteContextType>(routeTest, manifest, { Tutorials: { route: defaultRoute }, TutorialDetail: { route: detailRoute, input: { id: '1' } } });
testRoutes<RouteContextType>(routeTest, manifest, {
  Tutorials: { route: defaultRoute },
  TutorialDetail: { route: detailRoute, input: { id: '1' } },
  Playlists: { route: playlistsRoute },
  // @ts-expect-error Cases name catalogue routes only.
  Extra: { route: playlistsRoute },
});
const wrongRoute: RouteTestCases<RouteContextType> = {
  // @ts-expect-error A case renders its own route's definition.
  Tutorials: { route: playlistsRoute },
  TutorialDetail: { route: detailRoute, input: { id: '1' } },
  Playlists: { route: playlistsRoute },
};
const missingInput: RouteTestCases<RouteContextType> = {
  Tutorials: { route: defaultRoute, input: { filter: 'optional' } },
  // @ts-expect-error Routes with required fields need input.
  TutorialDetail: { route: detailRoute },
  Playlists: { route: playlistsRoute },
};
void [wrongRoute, missingInput];
void renderRoute(defaultRoute);
void renderRoute(detailRoute, { input: { id: '1' } });
// @ts-expect-error Required fields need input.
void renderRoute(detailRoute);
// @ts-expect-error Input matches the route's fields.
void renderRoute(detailRoute, { input: { id: 1 } });
