import { Suspense } from 'react';
import { Outlet, useMatch } from 'react-router';
import { AppShell } from '@astryxdesign/core/AppShell';
import { SideNav, SideNavItem } from '@astryxdesign/core/SideNav';
import { Link, Stack, Text } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';

import { HomeURI, ProfileURI } from '../../routes/__generated__/routes';

export function NavigationShell() {
  const { homeActive, profileActive } = useNavigationShell();
  return (
    <AppShell height="auto" variant="section" sideNav={
      <SideNav aria-label="Main navigation" xstyle={styles.sidebar} header={
        <Stack padding={4}>
          <Link href={HomeURI.getURI({})} color="primary" weight="bold" size="xl" isStandalone>tsquid</Link>
        </Stack>
      }>
        <SideNavItem label="Home" href={HomeURI.getURI({})} isSelected={homeActive} />
        <SideNavItem label="Profile" href={ProfileURI.getURI({})} isSelected={profileActive} />
      </SideNav>
    }>
      <Suspense fallback={<Stack padding={6}><Text>Loading…</Text></Stack>}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

function useNavigationShell() {
  const home = useMatch(HomeURI.path);
  const profile = useMatch(ProfileURI.path + '/*');
  return { homeActive: Boolean(home), profileActive: Boolean(profile) };
}

const styles = stylex.create({
  sidebar: { width: 260 },
});
