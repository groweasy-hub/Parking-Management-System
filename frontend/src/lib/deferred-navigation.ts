export function deferNavigation(navigate: () => void): () => void {
  const timeout = window.setTimeout(navigate, 0);
  return () => window.clearTimeout(timeout);
}
