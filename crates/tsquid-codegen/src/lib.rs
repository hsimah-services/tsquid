use graphql_parser::query::{
    Definition, Document, OperationDefinition, Selection, SelectionSet, Type, Value,
};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, path::Path};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Config {
    runtime: String,
    /// Relay's local persisted-queries file, relative to the config. Read by the CLI.
    #[serde(rename = "persistedQueries", default)]
    persisted_queries: Option<String>,
    routes: Vec<Route>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Route {
    name: String,
    #[serde(rename = "entryPoint")]
    entry_point: String,
    path: String,
    fields: BTreeMap<String, Field>,
    #[serde(default = "enabled")]
    ssr: bool,
    /// The operation a server runs for this route; its variables are same-named fields.
    #[serde(default)]
    query: Option<String>,
}
fn enabled() -> bool {
    true
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Field {
    kind: String,
    #[serde(default)]
    optional: bool,
}

fn identifier(s: &str) -> bool {
    !s.is_empty()
        && s.chars()
            .enumerate()
            .all(|(i, c)| c.is_ascii_alphabetic() || c == '_' || (i > 0 && c.is_ascii_digit()))
}
/// The host's input: routes.json and, when it names one, Relay's persisted queries.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    config: String,
    #[serde(rename = "persistedQueries", default)]
    persisted_queries: Option<String>,
}

/// Validates a request (`{"config", "persistedQueries"}` JSON) and returns the
/// generated TypeScript module.
pub fn generate_json(request: &str) -> Result<String, String> {
    let (config, queries) = load(request)?;
    let mut out = generate(&config)?;
    for route in &config.routes {
        let Some(query) = queries.get(&route.name) else { continue };
        let parameter = if query.variables.values().any(|variable| variable.input.is_some()) { "input" } else { "_input" };
        out += &format!("\nexport const {}RouteQuery = {{\n  operation: {},\n  getVariables: ({parameter}: {}InputType) => ({{\n", route.name, serde_json::to_string(&query.operation).unwrap(), route.name);
        for (name, variable) in &query.variables {
            let default = variable.default.as_ref().unwrap_or(&serde_json::Value::Null);
            let fallback = format!("{default}{}", if default.is_string() { " as const" } else { "" });
            let value = match &variable.input {
                Some(field) if !route.fields[field].optional => format!("input.{field}"),
                Some(field) => format!("input.{field} ?? {fallback}"),
                None => fallback,
            };
            out += &format!("    {}: {value},\n", serde_json::to_string(name).unwrap());
        }
        out += "  }),\n} as const;\n";
    }
    Ok(out)
}

/// Validates a request (`{"config", "persistedQueries"}` JSON) and returns the server
/// manifest. Every route is listed, so servers match URLs as the client does, then
/// skip non-SSR routes.
pub fn manifest_json(request: &str) -> Result<String, String> {
    let (config, queries) = load(request)?;
    generate(&config)?;
    Ok(manifest(&config, &queries))
}

fn load(request: &str) -> Result<(Config, BTreeMap<String, ManifestQuery>), String> {
    let request: Request = serde_json::from_str(request).map_err(|error| error.to_string())?;
    let config: Config = serde_json::from_str(&request.config).map_err(|error| error.to_string())?;
    let queries = queries(&config, request.persisted_queries.as_deref())?;
    Ok((config, queries))
}

#[derive(Serialize)]
struct Manifest<'a> {
    version: u32,
    routes: Vec<ManifestRoute<'a>>,
}
#[derive(Serialize)]
struct ManifestRoute<'a> {
    name: &'a str,
    path: &'a str,
    ssr: bool,
    fields: BTreeMap<&'a str, ManifestField<'a>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    query: Option<&'a ManifestQuery>,
}
#[derive(Serialize)]
struct ManifestField<'a> {
    kind: &'a str,
    optional: bool,
    #[serde(rename = "in")]
    location: &'static str,
}
#[derive(Serialize)]
struct ManifestQuery {
    operation: String,
    id: String,
    text: String,
    variables: BTreeMap<String, ManifestVariable>,
}
#[derive(Serialize)]
struct ManifestVariable {
    #[serde(skip_serializing_if = "Option::is_none")]
    input: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    default: Option<serde_json::Value>,
}

fn manifest(config: &Config, queries: &BTreeMap<String, ManifestQuery>) -> String {
    let routes = config
        .routes
        .iter()
        .map(|route| ManifestRoute {
            name: &route.name,
            path: &route.path,
            ssr: route.ssr,
            fields: route
                .fields
                .iter()
                .map(|(key, field)| {
                    let in_path = route.path.split('/').any(|part| part.strip_prefix(':') == Some(key));
                    (key.as_str(), ManifestField { kind: &field.kind, optional: field.optional, location: if in_path { "path" } else { "query" } })
                })
                .collect(),
            query: queries.get(&route.name),
        })
        .collect();
    serde_json::to_string_pretty(&Manifest { version: 1, routes }).unwrap() + "\n"
}

/// Resolves each route's `query` against Relay's persisted queries and checks that a
/// server can run it from the URL alone: a query, no @defer/@stream, no provided
/// variables, and every variable bound by a compatible field, a default, or null.
fn queries(config: &Config, persisted: Option<&str>) -> Result<BTreeMap<String, ManifestQuery>, String> {
    let mut result = BTreeMap::new();
    if config.routes.iter().all(|route| route.query.is_none()) {
        return Ok(result);
    }
    if config.persisted_queries.is_none() {
        return Err("Route queries require persistedQueries".into());
    }
    let persisted: BTreeMap<String, String> = serde_json::from_str(persisted.ok_or("Persisted queries were not provided")?)
        .map_err(|error| format!("Invalid persisted queries: {error}"))?;
    let mut operations: BTreeMap<String, Vec<(&str, &str, Document<String>)>> = BTreeMap::new();
    for (id, text) in &persisted {
        let document = graphql_parser::parse_query::<String>(text).map_err(|error| format!("Persisted query {id}: {error}"))?;
        let name = document.definitions.iter().find_map(|definition| match definition {
            Definition::Operation(OperationDefinition::Query(query)) => query.name.clone(),
            Definition::Operation(OperationDefinition::Mutation(mutation)) => mutation.name.clone(),
            Definition::Operation(OperationDefinition::Subscription(subscription)) => subscription.name.clone(),
            _ => None,
        });
        if let Some(name) = name {
            operations.entry(name).or_default().push((id, text, document));
        }
    }
    for route in &config.routes {
        let Some(name) = &route.query else { continue };
        let prefix = format!("Route {} query {name}", route.name);
        if !route.ssr {
            return Err(format!("{prefix}: query requires ssr"));
        }
        let (id, text, document) = match operations.get(name).map(Vec::as_slice) {
            Some([operation]) => operation,
            Some(versions) => return Err(format!("{prefix}: {} persisted versions; regenerate them from an empty file with relay-compiler --repersist", versions.len())),
            None => return Err(format!("{prefix}: not in persisted queries")),
        };
        let mut definitions = Vec::new();
        for definition in &document.definitions {
            match definition {
                Definition::Operation(OperationDefinition::Query(query)) => definitions = query.variable_definitions.iter().collect(),
                Definition::Operation(_) => return Err(format!("{prefix}: not a query")),
                Definition::Fragment(_) => {}
            }
            let set = match definition {
                Definition::Operation(OperationDefinition::Query(query)) => &query.selection_set,
                Definition::Fragment(fragment) => &fragment.selection_set,
                Definition::Operation(_) => unreachable!(),
            };
            if incremental(set) {
                return Err(format!("{prefix}: uses @defer or @stream"));
            }
        }
        let mut variables = BTreeMap::new();
        for definition in definitions {
            let variable = &definition.name;
            if variable.starts_with("__relay_internal__pv__") {
                return Err(format!("{prefix}: uses provided variable ${variable}"));
            }
            let required = matches!(definition.var_type, Type::NonNullType(_)) && definition.default_value.is_none();
            let input = match route.fields.get(variable) {
                Some(field) => {
                    if !compatible(&field.kind, &definition.var_type) {
                        return Err(format!("{prefix}: field {variable} ({}) can't bind ${variable}: {}", field.kind, definition.var_type));
                    }
                    if required && field.optional {
                        return Err(format!("{prefix}: ${variable} is required but field {variable} is optional"));
                    }
                    Some(variable.clone())
                }
                None if required => return Err(format!("{prefix}: ${variable} is required but route has no field {variable}")),
                None => None,
            };
            let default = definition.default_value.as_ref().map(json).transpose().map_err(|error| format!("{prefix}: ${variable}: {error}"))?;
            variables.insert(variable.clone(), ManifestVariable { input, default });
        }
        result.insert(route.name.clone(), ManifestQuery { operation: name.clone(), id: id.to_string(), text: text.to_string(), variables });
    }
    Ok(result)
}

fn incremental(set: &SelectionSet<String>) -> bool {
    set.items.iter().any(|item| {
        let (directives, children) = match item {
            Selection::Field(field) => (&field.directives, Some(&field.selection_set)),
            Selection::FragmentSpread(spread) => (&spread.directives, None),
            Selection::InlineFragment(fragment) => (&fragment.directives, Some(&fragment.selection_set)),
        };
        directives.iter().any(|directive| directive.name == "defer" || directive.name == "stream") || children.is_some_and(incremental)
    })
}

/// URL kinds bind GraphQL types of the same shape: int → Int, bool → Boolean, string →
/// any other scalar or enum, and [] → a list of those.
fn compatible(kind: &str, ty: &Type<String>) -> bool {
    let (base, ty) = match (kind.strip_suffix("[]"), nullable(ty)) {
        (Some(base), Type::ListType(inner)) => (base, nullable(inner)),
        (None, ty) => (kind, ty),
        _ => return false,
    };
    let Type::NamedType(name) = ty else { return false };
    match base {
        "int" => name == "Int",
        "bool" => name == "Boolean",
        _ => !["Int", "Boolean", "Float"].contains(&name.as_str()),
    }
}

fn nullable<'a, 'b>(ty: &'b Type<'a, String>) -> &'b Type<'a, String> {
    match ty {
        Type::NonNullType(inner) => inner,
        other => other,
    }
}

fn json(value: &Value<String>) -> Result<serde_json::Value, String> {
    Ok(match value {
        Value::Variable(name) => return Err(format!("default refers to ${name}")),
        Value::Int(number) => number.as_i64().ok_or("integer default out of range")?.into(),
        Value::Float(number) => serde_json::Number::from_f64(*number).ok_or("non-finite default")?.into(),
        Value::String(text) | Value::Enum(text) => text.clone().into(),
        Value::Boolean(flag) => (*flag).into(),
        Value::Null => serde_json::Value::Null,
        Value::List(items) => items.iter().map(json).collect::<Result<Vec<_>, _>>()?.into(),
        Value::Object(fields) => fields.iter().map(|(key, value)| Ok((key.clone(), json(value)?))).collect::<Result<serde_json::Map<_, _>, String>>()?.into(),
    })
}

fn generate(config: &Config) -> Result<String, String> {
    let mut out = format!("// @generated by tsquid-codegen. Do not edit.\nimport {{ createURI }} from {};\nimport {{ createRouteContextRegistry, type RouteContextValue }} from {};\n", serde_json::to_string(&format!("{}/uri",config.runtime)).unwrap(), serde_json::to_string(&format!("{}/context",config.runtime)).unwrap());
    let mut names = std::collections::BTreeSet::new();
    let mut paths = std::collections::BTreeSet::new();
    let mut entry_points: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    let mut modules = BTreeMap::new();
    out += "\nexport enum RouteName {\n";
    for route in &config.routes {
        if !identifier(&route.name)
            || ["__proto__", "constructor", "prototype"].contains(&route.name.as_str())
        {
            return Err("Invalid route name".into());
        }
        let module = route.entry_point.as_str();
        let entry_point = Path::new(module)
            .file_name()
            .and_then(|s| s.to_str())
            .and_then(|s| s.strip_suffix(".entrypoint.ts"))
            .filter(|s| identifier(s))
            .ok_or("Entrypoint modules must be named <Name>.entrypoint.ts")?;
        if module.contains('\\')
            || Path::new(module).is_absolute()
            || module
                .split('/')
                .any(|part| part.is_empty() || part == "." || part == "..")
        {
            return Err(
                "Entrypoint module paths must be normalized paths relative to the config".into(),
            );
        }
        if let Some(previous) = modules.insert(entry_point, module) {
            if previous != module {
                return Err(format!("Entrypoint module name {entry_point} is ambiguous"));
            }
        }
        entry_points
            .entry(entry_point)
            .or_default()
            .push(&route.name);
        out += &format!(
            "  {} = {},\n",
            route.name,
            serde_json::to_string(&route.name).unwrap()
        );
    }
    out += "}\n";
    for route in &config.routes {
        if !identifier(&route.name) || !names.insert(&route.name) {
            return Err("Invalid or duplicate route name".into());
        }
        if !route.path.starts_with('/')
            || route.path.contains(['?', '#', '*', '\\'])
            || route.path.contains("//")
            || route.path.split('/').any(|part| {
                part == "." || part == ".." || (!part.starts_with(':') && part.contains(':'))
            })
            || !paths.insert(&route.path)
        {
            return Err("Invalid or duplicate route path".into());
        }
        let mut params = std::collections::BTreeSet::new();
        for part in route.path.split('/').filter(|s| s.starts_with(':')) {
            let key = &part[1..];
            let field = route
                .fields
                .get(key)
                .ok_or(format!("Missing path field {key}"))?;
            if field.optional || field.kind.ends_with("[]") || !params.insert(key) {
                return Err(format!("Invalid path field {key}"));
            }
        }
        out += &format!("\nexport type {}InputType = {{\n", route.name);
        for (key, field) in &route.fields {
            if !identifier(key) || ["__proto__", "constructor", "prototype"].contains(&key.as_str())
            {
                return Err(format!("Invalid field {key}"));
            }
            let (base, array) = field
                .kind
                .strip_suffix("[]")
                .map_or((field.kind.as_str(), false), |s| (s, true));
            let ts = match base {
                "string" => "string",
                "int" => "number",
                "bool" => "boolean",
                _ => return Err(format!("Unsupported kind {}", field.kind)),
            };
            out += &format!(
                "  {key}{}: {ts}{};\n",
                if field.optional { "?" } else { "" },
                if array { "[]" } else { "" }
            );
        }
        out += "};\n";
        let fields: BTreeMap<_, _> = route
            .fields
            .iter()
            .map(|(k, v)| (k, serde_json::json!({"kind":v.kind,"optional":v.optional})))
            .collect();
        out += &format!(
            "export const {}URI = createURI<{}InputType>({}, {});\n\n",
            route.name,
            route.name,
            serde_json::to_string(&route.path).unwrap(),
            serde_json::to_string(&fields).unwrap()
        );
    }
    out += "\nexport type RouteContextType =\n";
    if config.routes.is_empty() {
        out += "  never;\n";
    } else {
        for (index, route) in config.routes.iter().enumerate() {
            out += &format!(
                "  {}RouteContextValue<{}InputType, RouteName.{}>{}\n",
                if index == 0 { "" } else { "| " },
                route.name,
                route.name,
                if index + 1 == config.routes.len() {
                    ";"
                } else {
                    ""
                }
            );
        }
    }
    out += "\nconst ROUTE_CONTEXT = createRouteContextRegistry<RouteContextType>();\n";
    for route in &config.routes {
        out += &format!(
            "export const {}RouteContext = ROUTE_CONTEXT.forRoute(RouteName.{});\n",
            route.name, route.name
        );
    }
    for (entry_point, routes) in entry_points {
        out += &format!("\nexport type {entry_point}EntryPointParams =\n");
        for (index, route) in routes.iter().enumerate() {
            out += &format!("  {}{{ currentRoute: RouteName.{route}; input: {route}InputType }}{}\n", if index == 0 { "" } else { "| " }, if index + 1 == routes.len() { ";" } else { "" });
        }
        let route_names = routes
            .iter()
            .map(|name| format!("RouteName.{name}"))
            .collect::<Vec<_>>()
            .join(" | ");
        out += &format!("\nexport type {entry_point}RouteContextType = Extract<RouteContextType, {{ currentRoute: {route_names} }}>;\nexport function use{entry_point}RouteContext(): {entry_point}RouteContextType {{\n  const context = ROUTE_CONTEXT.useRouteContext();\n  const currentRoute = context.currentRoute;\n  switch (context.currentRoute) {{\n");
        for route in routes {
            out += &format!("    case RouteName.{route}:\n");
        }
        out += &format!("      return context;\n    default:\n      throw new Error('use{entry_point}RouteContext requires the {entry_point} entrypoint; current route is ' + currentRoute);\n  }}\n}}\n");
    }
    Ok(out)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn config(path: &str, fields: &str) -> Config {
        serde_json::from_str(&format!(r#"{{"runtime":"./runtime","routes":[{{"name":"Tutorial","entryPoint":"Tutorial.entrypoint.ts","path":"{path}","fields":{fields}}}]}}"#)).unwrap()
    }
    #[test]
    fn generates_types() {
        let text = generate(&config(
            "/tutorials/:id",
            r#"{"id":{"kind":"int"},"tags":{"kind":"string[]","optional":true}}"#,
        ))
        .unwrap();
        assert!(text.contains("id: number"));
        assert!(text.contains("tags?: string[]"));
        assert!(text.contains("TutorialRouteContext"));
        assert!(text.contains("export type TutorialEntryPointParams =\n  { currentRoute: RouteName.Tutorial; input: TutorialInputType };"));
    }
    #[test]
    fn rejects_bad_schemas() {
        for (path, fields) in [
            ("/x/:id", "{}"),
            ("/x/:id", r#"{"id":{"kind":"int","optional":true}}"#),
            ("/x", r#"{"id":{"kind":"object"}}"#),
            ("/x/:id", r#"{"id":{"kind":"int[]"}}"#),
        ] {
            assert!(generate(&config(path, fields)).is_err());
        }
    }
    #[test]
    fn generated_fixture_is_current() {
        assert_eq!(
            generate_json(&request(FIXTURE, Some(PERSISTED))).unwrap(),
            include_str!("../../../packages/routes/tests/routes.generated.ts")
        );
    }

    fn request(config: &str, persisted: Option<&str>) -> String {
        serde_json::json!({ "config": config, "persistedQueries": persisted }).to_string()
    }
    const FIXTURE: &str = include_str!("../../../packages/routes/tests/routes.json");
    const PERSISTED: &str = include_str!("../../../packages/routes/tests/persisted_queries.json");

    #[test]
    fn generated_manifest_is_current() {
        assert_eq!(
            manifest_json(&request(FIXTURE, Some(PERSISTED))).unwrap(),
            include_str!("../../../packages/routes/tests/routes.generated.manifest.json")
        );
        assert_eq!(
            generate_json(&request(FIXTURE, Some(PERSISTED))).unwrap(),
            include_str!("../../../packages/routes/tests/routes.generated.ts")
        );
    }

    /// Manifest for one route `/t/:id` with `fields` and `query Q` declaring `variables`.
    fn route_query(fields: &str, variables: &str, body: &str) -> Result<serde_json::Value, String> {
        let config = format!(r#"{{"runtime":"x","persistedQueries":"p.json","routes":[{{"name":"T","entryPoint":"T.entrypoint.ts","path":"/t/:id","fields":{fields},"query":"Q"}}]}}"#);
        let persisted = serde_json::json!({ "a": format!("query Q{variables} {{ t {body} }}") }).to_string();
        manifest_json(&request(&config, Some(&persisted))).map(|text| serde_json::from_str(&text).unwrap())
    }

    #[test]
    fn route_queries_bind_fields_defaults_and_nulls() {
        let manifest = route_query(
            r#"{"id":{"kind":"string"},"tags":{"kind":"string[]","optional":true},"page":{"kind":"int","optional":true},"draft":{"kind":"bool","optional":true}}"#,
            "($id: ID!, $tags: [String!], $page: Int = 1, $draft: Boolean, $order: Order = NEWEST, $filter: F = {a: [1, null], b: \"x\"}, $after: String)",
            "{ id }",
        )
        .unwrap();
        let query = &manifest["routes"][0]["query"];
        assert_eq!(query["operation"], "Q");
        assert_eq!(query["id"], "a");
        assert_eq!(query["variables"], serde_json::json!({
            "id": { "input": "id" }, "tags": { "input": "tags" }, "page": { "input": "page", "default": 1 },
            "draft": { "input": "draft" }, "order": { "default": "NEWEST" },
            "filter": { "default": { "a": [1, null], "b": "x" } }, "after": {}
        }));
    }

    #[test]
    fn generates_query_variable_bindings() {
        let config = r#"{"runtime":"x","persistedQueries":"p.json","routes":[{"name":"T","entryPoint":"T.entrypoint.ts","path":"/t/:id","fields":{"id":{"kind":"string"},"page":{"kind":"int","optional":true},"tags":{"kind":"string[]","optional":true}},"query":"Q"}]}"#;
        let persisted = serde_json::json!({ "a": "query Q($id: ID!, $page: Int = 1, $tags: [String!], $after: String, $order: Order = NEWEST) { t { id } }" }).to_string();
        let generated = generate_json(&request(config, Some(&persisted))).unwrap();
        assert!(generated.ends_with("\nexport const TRouteQuery = {\n  operation: \"Q\",\n  getVariables: (input: TInputType) => ({\n    \"after\": null,\n    \"id\": input.id,\n    \"order\": \"NEWEST\" as const,\n    \"page\": input.page ?? 1,\n    \"tags\": input.tags ?? null,\n  }),\n} as const;\n"));
    }

    #[test]
    fn rejects_route_queries_a_server_cannot_run_from_the_url() {
        let id = r#"{"id":{"kind":"string"}}"#;
        for (fields, variables, body, error) in [
            (id, "($id: ID!, $first: Int!)", "{ id }", "$first is required but route has no field first"),
            (r#"{"id":{"kind":"string"},"n":{"kind":"int","optional":true}}"#, "($n: Int!)", "{ id }", "$n is required but field n is optional"),
            (id, "($id: Int)", "{ id }", "field id (string) can't bind $id: Int"),
            (r#"{"id":{"kind":"string"},"n":{"kind":"int"}}"#, "($n: String)", "{ id }", "field n (int) can't bind"),
            (r#"{"id":{"kind":"string"},"n":{"kind":"int[]"}}"#, "($n: Int)", "{ id }", "field n (int[]) can't bind"),
            (r#"{"id":{"kind":"string"},"b":{"kind":"bool"}}"#, "($b: [Boolean])", "{ id }", "field b (bool) can't bind"),
            (id, "($__relay_internal__pv__X: Boolean!)", "{ id }", "provided variable"),
            (id, "", "{ id ... on T @defer { name } }", "@defer or @stream"),
            (id, "", "{ items @stream { id } }", "@defer or @stream"),
        ] {
            let result = route_query(fields, variables, body);
            assert!(result.as_ref().is_err_and(|e| e.contains(error)), "{variables} {body}: {result:?}");
        }
    }

    #[test]
    fn rejects_unresolvable_route_queries() {
        let route = r#"{"name":"T","entryPoint":"T.entrypoint.ts","path":"/t","fields":{},"query":"Q"}"#;
        let config = |extra: &str| format!(r#"{{"runtime":"x"{extra},"routes":[{route}]}}"#);
        let with_file = config(r#","persistedQueries":"p.json""#);
        for (config, persisted, error) in [
            (config(""), Some("{}"), "require persistedQueries"),
            (with_file.clone(), None, "not provided"),
            (with_file.clone(), Some("[]"), "Invalid persisted queries"),
            (with_file.clone(), Some(r#"{"a":"query {"}"#), "Persisted query a"),
            (with_file.clone(), Some(r#"{"a":"query R { t }"}"#), "not in persisted queries"),
            (with_file.clone(), Some(r#"{"a":"query Q { t }","b":"query Q { u }"}"#), "2 persisted versions"),
            (with_file.clone(), Some(r#"{"a":"mutation Q { t }"}"#), "not a query"),
            (with_file.replace(r#""query":"Q""#, r#""query":"Q","ssr":false"#), Some(r#"{"a":"query Q { t }"}"#), "requires ssr"),
        ] {
            let result = manifest_json(&request(&config, persisted));
            assert!(result.as_ref().is_err_and(|e| e.contains(error)), "{error}: {result:?}");
            assert_eq!(generate_json(&request(&config, persisted)).err(), result.err());
        }
        assert!(manifest_json(&request(&config(""), None)).is_err());
        let ok = manifest_json(&request(&with_file, Some(r#"{"a":"query Q { t }","b":"fragment F on T { t }"}"#))).unwrap();
        assert!(ok.contains(r#""operation": "Q""#));
    }

    #[test]
    fn manifest_lists_routes_with_ssr_and_field_locations() {
        let mut config = config("/tutorials/:id", r#"{"id":{"kind":"int"},"tags":{"kind":"string[]","optional":true}}"#);
        let manifest: serde_json::Value = serde_json::from_str(&super::manifest(&config, &BTreeMap::new())).unwrap();
        assert_eq!(manifest["version"], 1);
        assert_eq!(manifest["routes"][0]["ssr"], true);
        assert_eq!(manifest["routes"][0]["fields"]["id"], serde_json::json!({"kind":"int","optional":false,"in":"path"}));
        assert_eq!(manifest["routes"][0]["fields"]["tags"]["in"], "query");
        config.routes[0].ssr = false;
        let manifest: serde_json::Value = serde_json::from_str(&super::manifest(&config, &BTreeMap::new())).unwrap();
        assert_eq!(manifest["routes"][0]["ssr"], false);
        assert!(manifest_json(&request(r#"{"runtime":"x","routes":[{"name":"A","entryPoint":"A.ts","path":"/","fields":{}}]}"#, None)).is_err());
    }

    #[test]
    fn derives_hooks_from_entrypoint_module_names() {
        let config: Config = serde_json::from_str(include_str!("../../../packages/routes/tests/routes.json")).unwrap();
        let text = generate(&config).unwrap();
        assert!(text.contains("export enum RouteName"));
        assert_eq!(
            text.matches("export function useTutorialRouteContext()")
                .count(),
            1
        );
        assert!(text.contains("currentRoute: RouteName.Tutorials | RouteName.TutorialDetail"));
        assert!(text.contains("export function usePlaylistRouteContext()"));
    }

    #[test]
    fn rejects_invalid_or_ambiguous_module_names() {
        for module in [
            "Tutorial",
            "Tutorial.ts",
            "Tutorial.entrypoint.tsx",
            "bad-name.entrypoint.ts",
            "/Tutorial.entrypoint.ts",
            "../Tutorial.entrypoint.ts",
        ] {
            let mut config = config("/tutorials", "{}");
            config.routes[0].entry_point = module.into();
            assert!(generate(&config).is_err(), "{module}");
        }
        let mut config: Config =
            serde_json::from_str(include_str!("../../../packages/routes/tests/routes.json")).unwrap();
        config.routes[1].entry_point = "other/Tutorial.entrypoint.ts".into();
        assert!(generate(&config).unwrap_err().contains("ambiguous"));
    }
}
