import { describe, it, expect, vi, beforeEach } from 'vitest'

const BACKEND_URL = 'https://mock-backend'
const UPLOAD_ENDPOINT = `${BACKEND_URL}/api/upload`
const HEALTH_ENDPOINT = `${BACKEND_URL}/api/upload/health`

const mockConfig = { get: vi.fn() }
vi.mock('../../../config/config.js', () => ({
  config: mockConfig
}))

mockConfig.get.mockImplementation((key) => {
  if (key === 'backendUrl') {
    return BACKEND_URL
  }
  return null
})

const { uploadFile, checkUploadHealth } =
  await import('./backend-upload-client.js')

const FILE_CONTENT = 'content'
const FILE_TYPE = 'application/pdf'

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('posts a file and returns the parsed JSON response on success', async () => {
    const mockResult = { reviewId: 'abc-123' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResult)
      })
    )

    const file = new File([FILE_CONTENT], 'test.pdf', { type: FILE_TYPE })
    const result = await uploadFile(file)

    expect(fetch).toHaveBeenCalledWith(
      UPLOAD_ENDPOINT,
      expect.objectContaining({ method: 'POST', credentials: 'include' })
    )
    expect(result).toEqual(mockResult)
    vi.unstubAllGlobals()
  })

  it('throws an error with the server error message when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'File too large' })
      })
    )

    const file = new File([FILE_CONTENT], 'big.pdf', { type: FILE_TYPE })
    await expect(uploadFile(file)).rejects.toThrow('File too large')
    vi.unstubAllGlobals()
  })

  it('throws "Upload failed" when error response has no error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({})
      })
    )

    const file = new File([FILE_CONTENT], 'bad.pdf', { type: FILE_TYPE })
    await expect(uploadFile(file)).rejects.toThrow('Upload failed')
    vi.unstubAllGlobals()
  })
})

describe('checkUploadHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns parsed JSON on a healthy response', async () => {
    const mockHealth = { status: 'ok' }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockHealth)
      })
    )

    const result = await checkUploadHealth()

    expect(fetch).toHaveBeenCalledWith(
      HEALTH_ENDPOINT,
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    )
    expect(result).toEqual(mockHealth)
    vi.unstubAllGlobals()
  })

  it('throws when the upload service is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false
      })
    )

    await expect(checkUploadHealth()).rejects.toThrow(
      'Upload service unavailable'
    )
    vi.unstubAllGlobals()
  })
})
