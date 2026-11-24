"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Input, Notice, RadioGroup } from "@/components/ui";
import { unlockAudio } from "@/lib/player/alert";
import { PLAYER_ERRORS, playerErrorMessage } from "@/lib/player/messages";
import { LEVELS, parseWalkIn, PLAYER_NAME_MAX } from "@/lib/queue/players";
import { createClient } from "@/lib/supabase/client";

type Errors = { display_name?: string; form?: string };

export function CheckInForm({ code }: { code: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Inside the tap: lets the "Ikaw na" chime play later.
    unlockAudio();

    const form = new FormData(event.currentTarget);
    // Level is optional; no answer means "Hindi sigurado".
    if (!form.get("level")) form.set("level", "unsure");
    const parsed = parseWalkIn(form);
    if (!parsed.ok) {
      setErrors({ display_name: parsed.errors.display_name });
      return;
    }

    setErrors({});
    setPending(true);
    const supabase = createClient();
    // Sign in only now, and only if this phone has no session yet.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setPending(false);
        setErrors({ form: PLAYER_ERRORS.signInFailed });
        return;
      }
    }

    const { error } = await supabase.rpc("join_session", {
      p_join_code: code,
      p_display_name: parsed.data.display_name,
      p_level: parsed.data.level,
    });
    if (error) {
      setPending(false);
      setErrors({ form: playerErrorMessage(error) });
      return;
    }
    router.push(`/j/${code}/me`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {errors.form && <Notice kind="error">{errors.form}</Notice>}
      <Input
        label="Pangalan mo"
        name="display_name"
        required
        maxLength={PLAYER_NAME_MAX}
        autoComplete="nickname"
        placeholder="hal. Tito Boy"
        error={errors.display_name}
      />
      <RadioGroup legend="Level mo? (optional)" name="level" options={LEVELS} />
      <div className="flex flex-col gap-1 text-muted">
        <p>Pangalan at level lang ang kinukuha namin, para makita ng organizer kung sino ang nasa pila.</p>
        <p>Walang account o app na kailangan.</p>
      </div>
      <Button type="submit" size="lg" variant="accent" fullWidth disabled={pending}>
        {pending ? "Pumipila…" : "Pumila na"}
      </Button>
    </form>
  );
}
