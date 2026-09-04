import { useEffect } from 'react';

/**
 * Sets the document title and meta description per route.
 *
 * A single-page app otherwise keeps the index.html title on every page, which
 * breaks bookmarks, tab identification and the first thing a screen reader
 * announces after a navigation.
 */
export function usePageMeta({ title, description }) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', description);
    }
  }, [title, description]);
}

export default usePageMeta;
