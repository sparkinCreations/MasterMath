import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    const baseTitle = 'MasterMath by sparkinCreations™';
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;
  }, [title]);
}
