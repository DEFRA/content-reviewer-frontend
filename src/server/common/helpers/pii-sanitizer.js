/**
 * PII Sanitization Helper for Frontend
 *
 * Provides client-side validation that content displayed in the UI
 * does not contain obvious PII patterns.
 *
 * This is a SECONDARY defense layer. The primary PII redaction
 * happens in the backend before storage.
 */

/**
 * Check if text appears to contain PII patterns
 * @param {string} text - Text to check
 * @returns {Object} Detection result
 */
export function detectPII(text) {
  if (!text || typeof text !== 'string') {
    return {
      hasPII: false,
      detectedPatterns: []
    }
  }

  const detectedPatterns = []

  // Email pattern
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g.test(text)) {
    detectedPatterns.push('email')
  }

  // UK phone number patterns
  if (
    /\b(?:(?:\+44\s?|0)(?:\d{2}\s?\d{4}\s?\d{4}|\d{3}\s?\d{3}\s?\d{4}|\d{4}\s?\d{6}|\d{5}\s?\d{5}))\b/g.test(
      text
    )
  ) {
    detectedPatterns.push('phone')
  }

  // UK National Insurance number
  if (
    /\b(?:[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z])\s?(?:\d{2}\s?\d{2}\s?\d{2}\s?[A-D]?)\b/gi.test(
      text
    )
  ) {
    detectedPatterns.push('ni_number')
  }

  // UK Postcode
  if (
    /\b[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}\b|\b[A-Z]{1,2}\d[A-Z]\s?\d[A-Z]{2}\b/gi.test(
      text
    )
  ) {
    detectedPatterns.push('postcode')
  }

  // Credit card pattern
  if (/\b(?:\d{4}[-\s]?){3}\d{1,4}\b/g.test(text)) {
    detectedPatterns.push('credit_card')
  }

  return {
    hasPII: detectedPatterns.length > 0,
    detectedPatterns
  }
}

/**
 * Validate that content is safe for display (no unredacted PII)
 * @param {string} content - Content to validate
 * @param {string} fieldName - Name of field being validated
 * @returns {Object} Validation result
 */
export function validateContentSafe(content, fieldName = 'content') {
  const detection = detectPII(content)

  if (detection.hasPII) {
    console.warn(
      `[PII SECURITY WARNING] Unredacted PII detected in ${fieldName}:`,
      detection.detectedPatterns
    )
    return {
      safe: false,
      warning: `Content may contain unredacted PII: ${detection.detectedPatterns.join(', ')}`,
      detectedPatterns: detection.detectedPatterns
    }
  }

  return {
    safe: true,
    warning: null
  }
}

/**
 * Check if text contains redaction placeholders (confirming it was redacted)
 * @param {string} text - Text to check
 * @returns {boolean} True if redaction placeholders found
 */
export function hasRedactionPlaceholders(text) {
  if (!text || typeof text !== 'string') {
    return false
  }

  const redactionPatterns = [
    /\[EMAIL_REDACTED\]/i,
    /\[PHONE_REDACTED\]/i,
    /\[NI_NUMBER_REDACTED\]/i,
    /\[POSTCODE_REDACTED\]/i,
    /\[CARD_NUMBER_REDACTED\]/i,
    /\[IP_ADDRESS_REDACTED\]/i,
    /\[DATE_REDACTED\]/i,
    /\[DRIVING_LICENSE_REDACTED\]/i,
    /\[PASSPORT_REDACTED\]/i,
    /\[SSN_REDACTED\]/i,
    /\[ACCOUNT_NUMBER_REDACTED\]/i,
    /\[SORT_CODE_REDACTED\]/i
  ]

  return redactionPatterns.some((pattern) => pattern.test(text))
}

/**
 * Sanitize content for safe display
 * Adds visual indicators for redacted content
 * @param {string} content - Content to sanitize
 * @returns {string} Sanitized content
 */
export function sanitizeForDisplay(content) {
  if (!content || typeof content !== 'string') {
    return content
  }

  // Replace redaction placeholders with styled HTML spans
  let sanitized = content

  const redactionReplacements = {
    '[EMAIL_REDACTED]':
      '<span class="pii-redacted" title="Email address redacted for privacy">***@***.***</span>',
    '[PHONE_REDACTED]':
      '<span class="pii-redacted" title="Phone number redacted for privacy">***-***-****</span>',
    '[NI_NUMBER_REDACTED]':
      '<span class="pii-redacted" title="National Insurance number redacted for privacy">**-**-**-*</span>',
    '[POSTCODE_REDACTED]':
      '<span class="pii-redacted" title="Postcode redacted for privacy">*** ***</span>',
    '[CARD_NUMBER_REDACTED]':
      '<span class="pii-redacted" title="Card number redacted for privacy">****-****-****-****</span>',
    '[IP_ADDRESS_REDACTED]':
      '<span class="pii-redacted" title="IP address redacted for privacy">***.***.***.***</span>',
    '[DATE_REDACTED]':
      '<span class="pii-redacted" title="Date redacted for privacy">**/**/****</span>',
    '[DRIVING_LICENSE_REDACTED]':
      '<span class="pii-redacted" title="Driving license redacted for privacy">********</span>',
    '[PASSPORT_REDACTED]':
      '<span class="pii-redacted" title="Passport number redacted for privacy">*********</span>',
    '[SSN_REDACTED]':
      '<span class="pii-redacted" title="Social security number redacted for privacy">***-**-****</span>',
    '[ACCOUNT_NUMBER_REDACTED]':
      '<span class="pii-redacted" title="Account number redacted for privacy">********</span>',
    '[SORT_CODE_REDACTED]':
      '<span class="pii-redacted" title="Sort code redacted for privacy">**-**-**</span>'
  }

  for (const [placeholder, replacement] of Object.entries(
    redactionReplacements
  )) {
    const regex = new RegExp(placeholder.replace(/[[\]]/g, '\\$&'), 'g')
    sanitized = sanitized.replace(regex, replacement)
  }

  return sanitized
}

/**
 * Log PII detection for monitoring
 * @param {string} fieldName - Name of field where PII was detected
 * @param {Array} detectedPatterns - Detected PII patterns
 */
export function logPIIDetection(fieldName, detectedPatterns) {
  if (detectedPatterns && detectedPatterns.length > 0) {
    console.error('[PII SECURITY ALERT]', {
      field: fieldName,
      patterns: detectedPatterns,
      timestamp: new Date().toISOString(),
      message:
        'Unredacted PII detected in content. This should not happen - backend redaction may have failed.'
    })

    // In production, you might want to send this to a security monitoring service
    // Example: sendToSecurityMonitoring({ field: fieldName, patterns: detectedPatterns })
  }
}
