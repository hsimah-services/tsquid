import { Card, Heading, Link, Stack, Text } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';

import { ProfileURI } from '../../routes/__generated__/routes';

export function HomePage() {
  return (
    <Stack padding={6} gap={6} align="stretch" xstyle={styles.page}>
      <Card elevation="low">
        <Stack gap={3} align="start">
          <Heading level={1}>Welcome to tsquid</Heading>
          <Text>
            Every page is a typed route. Add routes to routes.json, regenerate them with
            pnpm routes, and give each one an entrypoint that preloads its data.
          </Text>
          <Link href={ProfileURI.getURI({})} isStandalone>Your profile</Link>
        </Stack>
      </Card>
    </Stack>
  );
}

const styles = stylex.create({
  page: { width: '100%', maxWidth: 960, marginInline: 'auto' },
});
