import { supabase } from "@/integrations/supabase/client";

// Supabase always persists the session in localStorage. When the user unticks
// "Ghi nhớ đăng nhập", we mark the session as browser-session-only: a flag in
// localStorage plus a marker in sessionStorage. A new browser session has no
// marker, so the stored session is discarded on the next app start.
const EPHEMERAL_KEY = "storeflow-ephemeral-session";
const ALIVE_KEY = "storeflow-session-alive";

export function rememberSession(remember: boolean) {
  try {
    if (remember) {
      localStorage.removeItem(EPHEMERAL_KEY);
    } else {
      localStorage.setItem(EPHEMERAL_KEY, "1");
      sessionStorage.setItem(ALIVE_KEY, "1");
    }
  } catch {
    // Storage unavailable (private mode): fall back to Supabase's default persistence.
  }
}

export async function getActiveSession() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    if (localStorage.getItem(EPHEMERAL_KEY) && !sessionStorage.getItem(ALIVE_KEY)) {
      localStorage.removeItem(EPHEMERAL_KEY);
      await supabase.auth.signOut();
      return null;
    }
  } catch {
    // ignore storage errors
  }
  return data.session;
}

export async function signOut() {
  try {
    localStorage.removeItem(EPHEMERAL_KEY);
    sessionStorage.removeItem(ALIVE_KEY);
  } catch {
    // ignore storage errors
  }
  await supabase.auth.signOut();
}
