/**
 * Pure reordering reducer backing the drag-rank interests list (AC #2).
 *
 * All list mutation lives here (not in the component) so the ranking logic is
 * unit-tested without a DOM. The motion-powered drag UI and the keyboard
 * up/down controls both call these, keeping the two input paths identical.
 */

/** Move the item at `from` to index `to`, returning a new array. Indices out of
 *  range are clamped; a no-op move returns an equal-order copy. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (next.length === 0) return next;
  const clampedFrom = Math.max(0, Math.min(from, next.length - 1));
  const clampedTo = Math.max(0, Math.min(to, next.length - 1));
  const [moved] = next.splice(clampedFrom, 1);
  if (moved === undefined) return list.slice();
  next.splice(clampedTo, 0, moved);
  return next;
}

/** Move an item one step toward the front (higher preference). */
export function moveUp<T>(list: readonly T[], index: number): T[] {
  if (index <= 0) return list.slice();
  return reorder(list, index, index - 1);
}

/** Move an item one step toward the back (lower preference). */
export function moveDown<T>(list: readonly T[], index: number): T[] {
  if (index >= list.length - 1) return list.slice();
  return reorder(list, index, index + 1);
}

/** Remove the item at `index`, returning a new array. */
export function removeAt<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

/** Append `item` if absent (case-sensitive exact match); otherwise unchanged. */
export function addUnique(list: readonly string[], item: string): string[] {
  const trimmed = item.trim();
  if (trimmed.length === 0 || list.includes(trimmed)) return list.slice();
  return [...list, trimmed];
}

/** Remove `item` by exact value. */
export function removeValue(list: readonly string[], item: string): string[] {
  return list.filter((v) => v !== item);
}

/** Toggle `item` in/out of the list by exact value. */
export function toggleValue(list: readonly string[], item: string): string[] {
  return list.includes(item) ? removeValue(list, item) : addUnique(list, item);
}
