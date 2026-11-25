"use client";

import { useState } from "react";
import { EmptyState, Input, ListGroup, ListRow, RowText } from "@/components/ui";
import { SearchIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { duesLabel, matchesMember, type Member } from "@/lib/members/members";
import { levelLabel } from "@/lib/queue/players";

/** The club's members by name, with a search box. Tap a member to edit. */
export function MembersList({ members }: { members: Member[] }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const shown = members.filter((m) => matchesMember(m, query));

  return (
    <div className="flex flex-col gap-3">
      <Input
        label={t.members.search}
        type="search"
        autoComplete="off"
        placeholder={t.members.searchPlaceholder}
        leading={<SearchIcon className="size-4" />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length > 0 ? (
        <ListGroup aria-label={t.members.listLabel}>
          {shown.map((member) => (
            <ListRow key={member.id} href={`/members/${member.id}`}>
              <RowText title={member.name} detail={`${levelLabel(member.level, t)} · ${duesLabel(member.duesStatus, t)}`} />
            </ListRow>
          ))}
        </ListGroup>
      ) : (
        <EmptyState>{t.members.noResults(query.trim())}</EmptyState>
      )}
    </div>
  );
}
