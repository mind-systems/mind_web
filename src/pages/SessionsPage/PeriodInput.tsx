import { useEffect, useState } from 'react';

interface PeriodInputProps {
  value: number | null;
  maxSec: number;
  disabled: boolean;
  onCommit: (next: number | null) => void;
}

/**
 * Presentational "seconds" field for the shared period control. Purely controlled — no
 * fetching, no storage, no session knowledge beyond `maxSec`/`value`. Commits on blur and
 * Enter only (no per-keystroke updates, no debounce timer): empty ⇒ Auto (`null`), otherwise
 * a positive integer clamped to `[1, maxSec]`. Invalid input reverts the draft to `value`.
 */
export function PeriodInput({ value, maxSec, disabled, onCommit }: PeriodInputProps) {
  const [draft, setDraft] = useState(value == null ? '' : String(value));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      setDraft(value == null ? '' : String(value));
      return;
    }
    const clamped = Math.min(Math.max(parsed, 1), maxSec);
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <label className="flex shrink-0 items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
      Period, s
      <input
        type="number"
        min={1}
        step={1}
        placeholder="Auto"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        className="w-20 rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
    </label>
  );
}
