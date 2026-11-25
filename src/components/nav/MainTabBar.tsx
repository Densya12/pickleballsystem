"use client";

import { GearIcon, HomeIcon, UsersIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { TabBar } from "./TabBar";

/** Organizer top level: Home · Members · Settings. */
export function MainTabBar({ current }: { current: "home" | "members" | "settings" }) {
  const t = useT();
  return (
    <TabBar
      label={t.nav.mainMenu}
      current={current}
      items={[
        { key: "home", label: t.nav.home, href: "/", icon: <HomeIcon /> },
        { key: "members", label: t.nav.members, href: "/members", icon: <UsersIcon /> },
        { key: "settings", label: t.nav.settings, href: "/settings", icon: <GearIcon /> },
      ]}
    />
  );
}
