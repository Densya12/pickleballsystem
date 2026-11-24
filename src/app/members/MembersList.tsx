"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Input } from "@/components/ui";
import { ChevronRightIcon } from "@/components/ui/icons";
import { duesLabel, matchesMember, type Member } from "@/lib/members/members";
import { levelLabel } from "@/lib/queue/players";

/** The club's members by name, with a search box. Tap a member to edit. */
export function MembersList({ members }: { members: Member[] }) {
  const [query, setQuery] = useState("");
  const shown = members.filter((m) => matchesMember(m, query));

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Hanapin"
        type="search"
        autoComplete="off"
        placeholder="Pangalan ng member"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length > 0 ? (
        <Card padding="none" className="overflow-hidden">
          <ul aria-label="Mga member" className="flex flex-col divide-y divide-default">
            {shown.map((member) => (
              <li key={member.id}>
                <Link
                  href={`/members/${member.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-subtle focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold [overflow-wrap:anywhere]">{member.name}</span>
                    <span className="text-muted">
                      {levelLabel(member.level)} · {duesLabel(member.duesStatus)}
                    </span>
                  </span>
                  <ChevronRightIcon className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <p className="rounded-card border border-dashed border-strong px-5 py-4 text-muted">
          Walang member na &quot;{query.trim()}&quot;. Pindutin ang + Magdagdag ng member para idagdag.
        </p>
      )}
    </div>
  );
}
