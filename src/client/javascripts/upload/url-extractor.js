// URL extractor: validates a gov.uk URL and extracts govspeak text content
/* global DOMParser */
const GOVUK_HOSTNAME = 'www.gov.uk'
const GOVSPEAK_SELECTOR = 'div[data-module="govspeak"]'

/**
 * Validates that the provided string is a well-formed URL pointing to a gov.uk
 * page. Returns the parsed URL on success or null if invalid.
 * @param {string} urlString
 * @returns {URL|null}
 */
export function parseGovUkUrl(urlString) {
  let parsed
  try {
    parsed = new URL(urlString)
  } catch {
    return null
  }
  if (parsed.hostname !== GOVUK_HOSTNAME) {
    return null
  }
  return parsed
}

/**
 * Fetches the HTML for a validated gov.uk URL via the server-side proxy
 * (/api/fetch-url) to avoid CORS errors, then extracts govspeak text content.
 * Returns the extracted text string, or throws on network / parse failure.
 * @param {string} urlString
 * @returns {Promise<string>}
 */
export async function extractGovspeakText(urlString) {
  const proxyUrl = `/api/fetch-url?url=${encodeURIComponent(urlString)}`
  const response = await fetch(proxyUrl)
  if (!response.ok) {
    throw new Error(`Proxy fetch failed: ${response.status}`)
  }
  const html = await response.text()
  return parseGovspeakFromHtml(html)
}

/**
 * Parses raw HTML and returns the combined text of all govspeak divs.
 * Separated from the fetch so it can be unit-tested without network access.
 * @param {string} html
 * @returns {string}
 */
export function parseGovspeakFromHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove header and footer elements
  doc.querySelectorAll('header, footer').forEach((el) => el.remove())

  const govspeakDivs = doc.querySelectorAll(GOVSPEAK_SELECTOR)
  const texts = []
  govspeakDivs.forEach((div) => {
    const text = div.textContent.trim()
    if (text) {
      texts.push(text)
    }
  })
  return texts.join('\n\n')
}
