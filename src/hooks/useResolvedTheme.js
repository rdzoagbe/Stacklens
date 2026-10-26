import { useSyncExternalStore } from 'react';

// The theme the page shows right now ('dark' or 'light'), from data-theme on
// <html>, for the few colours that cannot be a class: chart axes and grid
// lines are SVG attributes, which do not read CSS variables.
const read = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
const subscribe = (onChange) => {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => obs.disconnect();
};

export function useResolvedTheme() {
  return useSyncExternalStore(subscribe, read, () => 'dark');
}
