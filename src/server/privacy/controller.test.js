import { describe, it, expect, vi } from 'vitest'
import { privacyController } from './controller.js'

const PRIVACY_NOTICE_TEXT = 'Privacy notice'

describe('privacyController', () => {
  it('should render the privacy page with correct context', () => {
    const h = { view: vi.fn() }
    privacyController.handler({}, h)
    expect(h.view).toHaveBeenCalledWith('privacy/index', {
      pageTitle: PRIVACY_NOTICE_TEXT,
      heading: PRIVACY_NOTICE_TEXT,
      breadcrumbs: [{ text: 'Home', href: '/' }, { text: PRIVACY_NOTICE_TEXT }]
    })
  })
})
