"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INACTIVITY_LIMIT_MS = 20 * 60 * 1000; // 20 minutes
const CHECK_INTERVAL_MS = 30 * 1000; // check every 30 seconds
const STORAGE_KEY = "grantflow_last_activity";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export default function InactivityGuard() {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function recordActivity() {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    async function checkInactivity() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Only enforce timeout when there is an active session
      if (!session) return;

      const raw = localStorage.getItem(STORAGE_KEY);
      const lastActivity = raw ? parseInt(raw, 10) : Date.now();
      const elapsed = Date.now() - lastActivity;

      if (elapsed >= INACTIVITY_LIMIT_MS) {
        await supabase.auth.signOut();
        router.replace("/auth/login?error=Session+expired+due+to+inactivity");
      }
    }

    // Stamp activity on load
    recordActivity();

    // Listen for user interaction
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true })
    );

    // Periodically check for inactivity
    intervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    // Also check immediately on mount (handles returning to a stale tab)
    checkInactivity();

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, recordActivity)
      );
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]);

  return null;
}
