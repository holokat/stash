function readMetaContent(selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const value = node?.getAttribute('content')?.trim();
    if (value) return value;
  }
  return '';
}

function toAbsoluteUrl(value) {
  if (!value) return '';
  try {
    return new URL(value, document.baseURI).href;
  } catch {
    return '';
  }
}

function findBestFavicon() {
  const selectors = [
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
    'link[rel~="icon"][sizes="192x192"]',
    'link[rel~="icon"][sizes="180x180"]',
    'link[rel~="icon"]',
    'link[rel="shortcut icon"]',
  ];

  for (const selector of selectors) {
    const href = document.querySelector(selector)?.getAttribute('href')?.trim();
    if (href) return toAbsoluteUrl(href);
  }

  try {
    return `${location.origin}/favicon.ico`;
  } catch {
    return '';
  }
}

function scrapePageMetadata() {
  const previewImage = toAbsoluteUrl(
    readMetaContent([
      'meta[property="og:image:secure_url"]',
      'meta[property="og:image:url"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image:src"]',
      'meta[name="twitter:image"]',
    ]) || document.querySelector('link[rel="image_src"]')?.getAttribute('href')?.trim() || ''
  );

  const description = readMetaContent([
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[name="description"]',
  ]);

  const title =
    readMetaContent([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ]) ||
    document.title ||
    '';

  return {
    previewImage,
    description,
    favicon: findBestFavicon(),
    title,
  };
}

export async function getTabPageMetadata(tabId) {
  if (!tabId) return {};

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: scrapePageMetadata,
    });

    return result?.result || {};
  } catch {
    return {};
  }
}
