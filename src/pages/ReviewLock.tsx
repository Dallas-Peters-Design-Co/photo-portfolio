import { type FormEvent, useState } from "react";
import { reviewsApi } from "../services/reviewService";

/**
 * A review behind a password: its title, and the box to type the password
 * in. Right, the browser keeps a pass for it (services/reviewPass.ts) and
 * the review opens; it isn't asked for again in this browser.
 */
export function ReviewLock({
  onUnlocked,
  slug,
  title,
}: {
  onUnlocked: () => void;
  slug: string;
  title: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await reviewsApi.unlock(slug, password);
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That isn't the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack review-lock" onSubmit={submit}>
      <p className="label label--quiet">Site review</p>
      <h1 className="review-page__notice-title">{title || "This review"}</h1>
      <p className="review-page__prose">
        This review is private. Enter the password you were sent with the link.
      </p>
      <label className="review-lock__field">
        <span className="label">Password</span>
        <input
          autoComplete="current-password"
          autoFocus
          className="review-lock__input"
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <p className="review-lock__error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="review-lock__button"
        disabled={busy || !password}
        type="submit"
      >
        {busy ? "Checking…" : "Open the review"}
      </button>
    </form>
  );
}
