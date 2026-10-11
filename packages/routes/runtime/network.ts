import { Observable, type FetchFunction, type GraphQLSingularResponse, type RequestParameters } from 'relay-runtime';

export type FetchGraphQLOptions = {
  url: string;
  fetch?: typeof fetch;
  headers?: (request: RequestParameters) => HeadersInit | Promise<HeadersInit>;
  credentials?: RequestCredentials;
};

export function createFetchGraphQL(options: FetchGraphQLOptions): FetchFunction {
  return (request, variables) => Observable.create(sink => {
    const controller = new AbortController();
    void (async () => {
      const headers = new Headers(await options.headers?.(request));
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      if (controller.signal.aborted) return;
      const response = await (options.fetch ?? fetch)(options.url, {
        method: 'POST', headers, credentials: options.credentials ?? 'same-origin', signal: controller.signal,
        body: JSON.stringify({ query: request.text, operationName: request.name, variables }),
      });
      if (!response.ok) throw new Error(`GraphQL request failed (${response.status}).`);
      const payload: GraphQLSingularResponse = await response.json();
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid GraphQL response.');
      if ('errors' in payload && payload.errors !== undefined && (!Array.isArray(payload.errors) || payload.errors.some(error => !error || typeof error.message !== 'string'))) throw new Error('Invalid GraphQL errors.');
      if (payload.data == null) {
        const errors = 'errors' in payload ? payload.errors : undefined;
        throw new Error(errors?.length ? errors.map(error => error.message).join(' ') : 'GraphQL response has no data.');
      }
      if (typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new Error('Invalid GraphQL data.');
      sink.next(payload);
      sink.complete();
    })().catch(error => { if (!controller.signal.aborted) sink.error(error); });
    return () => { controller.abort(); };
  });
}
