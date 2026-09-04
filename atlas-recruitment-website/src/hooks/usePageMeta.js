import { useEffect } from 'react';

/**
 * Sets the document title and meta description per route.
 *
 * A single-page app otherwise keeps the index.html title on every page, which
 * breaks bookmarks, tab identification and the first thing a screen reader
 * announces after a navigation.
 */
function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function usePageMeta({ title, description, robots }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) setMeta('description', description);

    // `robots` is set per-route rather than once in index.html because this is
    // a single-page app: a tag left behind by the previous route would follow
    // the visitor onto the next one. Removed again on unmount for that reason.
    if (robots) {
      setMeta('robots', robots);
      return () => document.querySelector('meta[name="robots"]')?.remove();
    }
    return undefined;
  }, [title, description, robots]);
}

export default usePageMeta;
