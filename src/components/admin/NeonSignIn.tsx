import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  isNeonAuthEnabled,
  neonTokenIfSignedIn,
  startGoogleSignIn,
} from "../../services/neonAuth";
import { authStorage } from "../../services/portfolioService";
import { sharingApi } from "../../services/sharingService";
import { Button } from "../ui/button";

/**
 * Sign-in for people a board was shared with: Google, through Neon Auth.
 *
 * Google sends them back to this page signed in with Neon; on the way back
 * this finds that sign-in, swaps it for the site's own session, and carries
 * on. The site lets in only addresses a board was shared with
 * (api/auth/google.ts). Renders nothing where Neon Auth is not set up.
 */
export function NeonSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [busy, setBusy] = useState(false);
  const tried = useRef<boolean>(false);

  useEffect(() => {
    if (tried.current || !isNeonAuthEnabled()) {
      return;
    }
    tried.current = true;
    let live = true;
    void (async () => {
      try {
        const neonToken = await neonTokenIfSignedIn();
        if (!(neonToken && live)) {
          return;
        }
        setBusy(true);
        authStorage.setToken(await sharingApi.loginWithNeon(neonToken));
        toast.success("Signed in");
        onSignedIn();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sign-in failed");
      } finally {
        if (live) {
          setBusy(false);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [onSignedIn]);

  if (!isNeonAuthEnabled()) {
    return null;
  }

  return (
    <div className="admin-gate__form stack stack--mid">
      <div aria-hidden className="admin-or">
        <span className="admin-or__rule" />
        <span className="admin-or__word">shared a board?</span>
        <span className="admin-or__rule" />
      </div>
      <Button
        disabled={busy}
        fullWidth
        onClick={() => {
          setBusy(true);
          startGoogleSignIn().catch((err: unknown) => {
            setBusy(false);
            toast.error(
              err instanceof Error ? err.message : "Couldn't start sign-in"
            );
          });
        }}
        size="lg"
        type="button"
        variant="outline"
      >
        {busy ? "Signing in…" : "Continue with Google"}
      </Button>
    </div>
  );
}
