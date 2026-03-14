const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';

function getSetCookies(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function joinCookieHeader(setCookies) {
  return setCookies
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

const authorize = await fetch(`${base}/api/v1/auth/sso/authorize?redirect_uri=${encodeURIComponent('/workbench')}`, {
  redirect: 'manual',
});
if (authorize.status !== 302) throw new Error(`authorize expected 302, got ${authorize.status}`);
const providerLocation = authorize.headers.get('location');
if (!providerLocation?.includes('/authorize')) throw new Error('authorize did not redirect to oidc provider');
console.log(`# authorize -> ${providerLocation}`);

const providerRedirect = await fetch(providerLocation, { redirect: 'manual' });
if (providerRedirect.status !== 302) throw new Error(`provider redirect expected 302, got ${providerRedirect.status}`);
const callbackLocation = providerRedirect.headers.get('location');
if (!callbackLocation?.includes('/api/v1/auth/sso/callback')) throw new Error('provider did not redirect to callback');
console.log(`# provider -> ${callbackLocation}`);

const callback = await fetch(callbackLocation, { redirect: 'manual' });
if (callback.status !== 302) throw new Error(`callback expected 302, got ${callback.status}`);
const setCookies = getSetCookies(callback);
if (setCookies.length === 0) throw new Error('callback did not set cookies');
const cookieHeader = joinCookieHeader(setCookies);
console.log(`# callback cookies -> ${cookieHeader}`);

const me = await fetch(`${base}/api/v1/me`, { headers: { Cookie: cookieHeader } });
const meData = await me.json();
console.log(JSON.stringify(meData, null, 2).slice(0, 1000));
if (meData.data?.email !== (process.env.OIDC_MOCK_EMAIL || 'oidc-smoke@example.com')) {
  throw new Error('oidc session me email mismatch');
}

const refreshed = await fetch(`${base}/api/v1/auth/refresh`, { method: 'POST', headers: { Cookie: cookieHeader }, redirect: 'manual' });
if (refreshed.status !== 200) throw new Error(`refresh expected 200, got ${refreshed.status}`);
const refreshedCookies = joinCookieHeader(getSetCookies(refreshed)) || cookieHeader;
const meAfterRefresh = await fetch(`${base}/api/v1/me`, { headers: { Cookie: refreshedCookies } });
const meAfterRefreshData = await meAfterRefresh.json();
if (meAfterRefreshData.data?.email !== (process.env.OIDC_MOCK_EMAIL || 'oidc-smoke@example.com')) {
  throw new Error('refreshed session me email mismatch');
}

const logout = await fetch(`${base}/api/v1/auth/logout`, { method: 'POST', headers: { Cookie: refreshedCookies } });
if (logout.status !== 200) throw new Error(`logout expected 200, got ${logout.status}`);
console.log('oidc smoke passed');
