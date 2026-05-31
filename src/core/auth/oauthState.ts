const OAUTH_STATE_KEY = 'oauth_state';

/**
 * Generate a one-time CSRF token for the OAuth state parameter, store it in
 * sessionStorage (tab-scoped, cleared on tab close), and return it.
 */
export function createOAuthState(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  return state;
}

/**
 * Read the stored OAuth state token and immediately remove it (one-time use).
 * Returns the value, or null if none was stored.
 */
export function consumeOAuthState(): string | null {
  const state = sessionStorage.getItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  return state;
}
