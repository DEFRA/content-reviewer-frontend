import { describe, expect, it, vi } from 'vitest'
import { catchAll } from './errors.js'

const HTTP_OK = 200
const HTTP_BAD_REQUEST = 400
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_NOT_FOUND = 404
const HTTP_INTERNAL_SERVER_ERROR = 500
const HTTP_I_AM_A_TEAPOT = 418

function makeRequest(statusCode, isBoom = true, stack = 'Error stack') {
  return {
    response: isBoom
      ? { isBoom: true, output: { statusCode }, stack }
      : { status: HTTP_OK },
    logger: { error: vi.fn() }
  }
}

function makeH() {
  const codeChain = { code: vi.fn().mockReturnThis() }
  return {
    continue: Symbol('continue'),
    view: vi.fn().mockReturnValue(codeChain)
  }
}

const ERROR_VIEW_PATH = 'error/index'

describe('catchAll', () => {
  it('should return h.continue when response is not a Boom error', () => {
    const request = makeRequest(HTTP_OK, false)
    const h = makeH()

    const result = catchAll(request, h)

    expect(result).toBe(h.continue)
    expect(h.view).not.toHaveBeenCalled()
  })

  it('should render error view with "Page not found" for 404', () => {
    const request = makeRequest(HTTP_NOT_FOUND)
    const h = makeH()

    catchAll(request, h)

    expect(h.view).toHaveBeenCalledWith(ERROR_VIEW_PATH, {
      pageTitle: 'Page not found',
      heading: HTTP_NOT_FOUND,
      message: 'Page not found'
    })
  })

  it('should render error view with "Forbidden" for 403', () => {
    const request = makeRequest(HTTP_FORBIDDEN)
    const h = makeH()

    catchAll(request, h)

    expect(h.view).toHaveBeenCalledWith(ERROR_VIEW_PATH, {
      pageTitle: 'Forbidden',
      heading: HTTP_FORBIDDEN,
      message: 'Forbidden'
    })
  })

  it('should render error view with "Unauthorized" for 401', () => {
    const request = makeRequest(HTTP_UNAUTHORIZED)
    const h = makeH()

    catchAll(request, h)

    expect(h.view).toHaveBeenCalledWith(ERROR_VIEW_PATH, {
      pageTitle: 'Unauthorized',
      heading: HTTP_UNAUTHORIZED,
      message: 'Unauthorized'
    })
  })

  it('should render error view with "Bad Request" for 400', () => {
    const request = makeRequest(HTTP_BAD_REQUEST)
    const h = makeH()

    catchAll(request, h)

    expect(h.view).toHaveBeenCalledWith(ERROR_VIEW_PATH, {
      pageTitle: 'Bad Request',
      heading: HTTP_BAD_REQUEST,
      message: 'Bad Request'
    })
  })

  it('should render error view with "Something went wrong" for 418', () => {
    const request = makeRequest(HTTP_I_AM_A_TEAPOT)
    const h = makeH()

    catchAll(request, h)

    expect(h.view).toHaveBeenCalledWith(ERROR_VIEW_PATH, {
      pageTitle: 'Something went wrong',
      heading: HTTP_I_AM_A_TEAPOT,
      message: 'Something went wrong'
    })
    expect(request.logger.error).not.toHaveBeenCalled()
  })

  it('should log the error stack for 5xx errors', () => {
    const request = makeRequest(
      HTTP_INTERNAL_SERVER_ERROR,
      true,
      'InternalServerError: boom'
    )
    const h = makeH()

    catchAll(request, h)

    expect(request.logger.error).toHaveBeenCalledWith(
      'InternalServerError: boom'
    )
  })

  it('should call .code() with the status code on the view response', () => {
    const request = makeRequest(HTTP_NOT_FOUND)
    const h = makeH()

    const viewResult = catchAll(request, h)

    expect(viewResult.code).toHaveBeenCalledWith(HTTP_NOT_FOUND)
  })
})
