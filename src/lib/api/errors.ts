export class MalformedResponseError extends Error {
  constructor() {
    super('malformed_response');
    this.name = 'MalformedResponseError';
  }
}

export class ProxyRequestError extends Error {
  constructor(public readonly httpStatus?: number) {
    super('proxy_request_error');
    this.name = 'ProxyRequestError';
  }
}

// AC-023: プロキシがレート制限超過時に返すHTTP 429を表す専用エラー。
// 機構自体のエラー(429以外の非2xx)は既存のProxyRequestErrorに倒しfail-closedとする。
export class RateLimitedError extends Error {
  constructor() {
    super('rate_limited');
    this.name = 'RateLimitedError';
  }
}
