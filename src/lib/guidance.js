// Key Insights and Common Mistakes: the lists every result carries.
//
// A solver writes each list ranked, most important first, and as long as is
// genuinely useful. The page shows the first SHOWN_AT_FIRST of each and puts
// the rest behind "Show more"; exports and history keep the whole list.
// Every solution is the same for everyone: no list is ever shuffled.
//
// An item is a string, or { text, source: { title, url } } when it uses a
// named idea from a specific source (LIATE, from Kasube 1983). Standard
// textbook facts carry no source. finalizeResult turns each list back into
// strings and keeps the sources in result.sources, keyed by the item's text,
// so everything that reads tips as text is unchanged.

export const SHOWN_AT_FIRST = 3;

// Sources link to the publisher or a DOI, nowhere else.
export const SOURCE_HOSTS = ['doi.org', 'www.tandfonline.com', 'www.jstor.org'];

export function isAllowedLink(url, hosts) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && hosts.includes(u.hostname);
  } catch {
    return false;
  }
}

// The lists as strings, and the sources found in them.
export function splitGuidance(items, sources = {}) {
  const texts = (Array.isArray(items) ? items : []).map((item) => {
    if (item && typeof item === 'object' && typeof item.text === 'string') {
      const { title, url } = item.source || {};
      if (typeof title === 'string' && title && isAllowedLink(url, SOURCE_HOSTS)) sources[item.text] = { title, url };
      return item.text;
    }
    return String(item);
  });
  return { texts, sources };
}

export function sourceOf(solution, text) {
  return solution?.sources?.[text] || null;
}
