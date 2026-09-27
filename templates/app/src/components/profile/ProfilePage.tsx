import { graphql, usePreloadedQuery, type PreloadedQuery } from 'react-relay';
import { Heading, Stack, Text } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';

import type { ProfileQuery } from './__generated__/ProfileQuery.graphql';

const PROFILE_QUERY = graphql`
  query ProfileQuery {
    viewer {
      id
      name
    }
  }
`;

export interface ProfilePageProps {
  queryRef: PreloadedQuery<ProfileQuery>;
}

export function ProfilePage({ queryRef }: ProfilePageProps) {
  const { viewer } = useProfilePage(queryRef);
  return (
    <Stack padding={6} gap={4} align="stretch" xstyle={styles.page}>
      <Heading level={1}>Profile</Heading>
      {viewer ? <Text>Signed in as {viewer.name}.</Text> : <Text color="secondary">Nobody is signed in.</Text>}
    </Stack>
  );
}

function useProfilePage(queryRef: PreloadedQuery<ProfileQuery>) {
  return usePreloadedQuery<ProfileQuery>(PROFILE_QUERY, queryRef);
}

const styles = stylex.create({
  page: { width: '100%', maxWidth: 960, marginInline: 'auto' },
});
