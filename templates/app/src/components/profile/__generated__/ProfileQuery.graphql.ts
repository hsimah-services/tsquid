/**
 * @generated SignedSource<<3092128c85cb35aff28e6314f0a57f6a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProfileQuery$variables = Record<PropertyKey, never>;
export type ProfileQuery$data = {
  readonly viewer: {
    readonly id: string;
    readonly name: string;
  } | null | undefined;
};
export type ProfileQuery = {
  response: ProfileQuery$data;
  variables: ProfileQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Viewer",
    "kind": "LinkedField",
    "name": "viewer",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "name",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProfileQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ProfileQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "0e84be14690d7e5a6e2acfd699bae55f",
    "id": null,
    "metadata": {},
    "name": "ProfileQuery",
    "operationKind": "query",
    "text": "query ProfileQuery {\n  viewer {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "bbb472f32b26c5a3ae8f465ea8705c0e";

export default node;
