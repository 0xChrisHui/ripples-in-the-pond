export const FIXTURE_OWNER = '0x1111111111111111111111111111111111111111';

const scores = [1, 2].map((tokenId) => ({
  id: String(tokenId),
  queueId: `j-score-${tokenId}`,
  tokenId,
  status: 'success',
  trackTitle: `J route fixture ${tokenId}`,
  eventCount: tokenId + 2,
  failureKind: null,
  submittedAt: '2026-09-24T00:00:00.000Z',
})).concat([{
  id: '99999999', queueId: 'j-missing', tokenId: 99999999, status: 'success',
  trackTitle: 'J missing public score', eventCount: 2, failureKind: null,
  submittedAt: '2026-09-24T00:00:00.000Z',
}]);

export const ARCHIVE_FIXTURES = new Map([
  ['/api/me/score-nfts', { scoreNfts: scores }],
  ['/api/me/scores', { scores: [] }],
  ['/api/me/nfts', { nfts: [] }],
  ['/api/me/pond-echoes', {
    echoes: [], onChainTotal: 0, truncated: false, originStatusUnavailable: false,
  }],
]);

export const AUTH_SOURCE = `(() => {
  const body = { sub: 'p11-j-fixture-owner', evm: '${FIXTURE_OWNER}',
    exp: Math.floor(Date.now() / 1000) + 7200 };
  const payload = btoa(JSON.stringify(body)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  localStorage.setItem('ripples_auth_jwt', 'e30.' + payload + '.fixture');
})()`;

export function fulfillJson(send, requestId, responseCode, value) {
  return send('Fetch.fulfillRequest', {
    requestId,
    responseCode,
    responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
    body: Buffer.from(JSON.stringify(value)).toString('base64'),
  });
}
