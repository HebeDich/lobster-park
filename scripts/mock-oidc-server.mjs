import http from 'node:http';
import { URL } from 'node:url';

const port = Number(process.env.OIDC_MOCK_PORT || 3410);
const issuer = process.env.OIDC_ISSUER_URL || `http://127.0.0.1:${port}`;
const email = process.env.OIDC_MOCK_EMAIL || 'oidc-smoke@example.com';
const name = process.env.OIDC_MOCK_NAME || 'OIDC Smoke User';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', issuer);

  if (url.pathname === '/.well-known/openid-configuration') {
    return json(res, 200, {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/userinfo`,
    });
  }

  if (url.pathname === '/authorize') {
    const redirectUri = url.searchParams.get('redirect_uri') || '';
    const state = url.searchParams.get('state') || '';
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set('code', 'mock-code');
    callbackUrl.searchParams.set('state', state);
    res.writeHead(302, { Location: callbackUrl.toString() });
    res.end();
    return;
  }

  if (url.pathname === '/token') {
    return json(res, 200, {
      access_token: 'mock-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: 'mock.header.mockpayload.mocksignature',
    });
  }

  if (url.pathname === '/userinfo') {
    return json(res, 200, {
      sub: 'mock-user',
      email,
      name,
      preferred_username: email,
    });
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`mock oidc listening on ${issuer}`);
});
