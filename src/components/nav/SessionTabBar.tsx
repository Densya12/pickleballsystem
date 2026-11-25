"use client";

import { GridIcon, ListIcon, MoreIcon, WalletIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { TabBar, type TabItem } from "./TabBar";

export type SessionTab = "courts" | "queue" | "payments";

/** Inside a live session: Courts · Queue · Payments · More (D19). */
export function SessionTabBar({
  sessionId,
  current,
  queueCount,
  paymentsBadge,
  showPayments,
  onMore,
}: {
  sessionId: string;
  current: SessionTab;
  /** null while loading: "Queue" without a count. */
  queueCount: number | null;
  /** To check + unpaid. */
  paymentsBadge: number;
  /** Free sessions have no Payments tab. */
  showPayments: boolean;
  /** Without it (while loading) More is disabled. */
  onMore?: () => void;
}) {
  const t = useT();
  const items: TabItem[] = [
    { key: "courts", label: t.nav.courts, href: `/s/${sessionId}`, icon: <GridIcon /> },
    { key: "queue", label: queueCount === null ? t.nav.queue : t.nav.queueCount(queueCount), href: `/s/${sessionId}/queue`, icon: <ListIcon /> },
  ];
  if (showPayments) {
    items.push({
      key: "payments",
      label: t.nav.payments,
      href: `/s/${sessionId}/payments`,
      icon: <WalletIcon />,
      badge: paymentsBadge,
      badgeLabel: t.nav.needsAction(paymentsBadge),
    });
  }
  items.push({ key: "more", label: t.nav.more, onClick: onMore, disabled: !onMore, icon: <MoreIcon /> });
  return <TabBar label={t.nav.session} current={current} items={items} width="w-[78px]" />;
}
