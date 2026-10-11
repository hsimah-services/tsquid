import { Button, Heading, Stack, Text } from '@astryxdesign/core';
import type { RouteErrorFallbackProps } from '@tsquid/routes/entrypoint';

export function NavigationRouteError({ error, retry }: RouteErrorFallbackProps) {
  return (
    <Stack gap={4} padding={6} align="start">
      <Heading level={1}>Unable to load this page</Heading>
      <Text>{error.message}</Text>
      <Button onClick={retry} label="Try again" />
    </Stack>
  );
}
