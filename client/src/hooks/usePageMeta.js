import { useEffect } from 'react';

function setMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Per-route title and description.
 *
 * A single-page app otherwise keeps one title for every page, which breaks
 * bookmarks, tab identification, and the first thing a screen reader announces
 * after a navigation. `robots` is removed on unmount because a tag left behind
 * by one route would silently follow the visitor to the next.
 */
export function usePageMeta({ title, description, robots }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) setMeta('description', description);
    if (robots) {
      setMeta('robots', robots);
      return () => document.querySelector('meta[name="robots"]')?.remove();
    }
    return undefined;
  }, [title, description, robots]);
}

export default usePageMeta;
