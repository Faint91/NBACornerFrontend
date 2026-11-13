const assert = require('node:assert/strict');
const { chromium } = require(require.resolve('@playwright/test', {
  paths: [process.env.PLAYWRIGHT_DEPENDENCIES || process.cwd()],
}));
const fs = require('node:fs');
const path = require('node:path');
const site = 'https://www.nbacorner.com';
const api = 'https://nba-api.invalid';
const profile = { id: 'fixture', username: 'Fixture', email: 'fixture@example.invalid', is_admin: false };
const headings = { '/dashboard': 'Playoff Brackets', '/account': 'Account' };

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    for (const session of ['valid', 'guest', 'invalid', 'expired', 'wrong-account', 'unavailable']) {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      if (session !== 'guest') {
        await context.addInitScript(({ profile, session }) => {
          if (sessionStorage.getItem('fixture-initialized')) return;
          localStorage.setItem('auth_token', 'offline-' + session);
          localStorage.setItem('auth_user', JSON.stringify(profile));
          sessionStorage.setItem('fixture-initialized', 'yes');
        }, { profile, session });
      }
      let pending = false;
      let release;
      let validation = new Promise(resolve => { release = resolve; });
      const failures = [];
      await context.route('**/*', async route => {
        const req = route.request();
        const url = new URL(req.url());
        const headers = await req.allHeaders();
        if (headers.authorization && url.origin !== api) failures.push('Bearer outside NBA API');
        if (url.origin === api) {
          const cors = { 'Access-Control-Allow-Origin': site, 'Access-Control-Allow-Headers': 'authorization, content-type' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
          if (url.pathname === '/auth/test-me') {
            pending = true;
            await validation;
            if (session === 'invalid' || session === 'expired') return route.fulfill({ status: 401, headers: cors, json: {} });
            if (session === 'unavailable') return route.fulfill({ status: 503, headers: cors, json: {} });
            return route.fulfill({ headers: cors, json: { user: { user_id: session === 'wrong-account' ? 'other' : profile.id, username: profile.username, is_admin: false } } });
          }
          if (session !== 'valid') failures.push('Protected API read without a validated session');
          return route.fulfill({ headers: cors, json: url.pathname === '/leagues/me' ? { leagues: [] } : url.pathname === '/brackets/me' ? { bracket: null } : [] });
        }
        if (url.origin !== site || req.method() !== 'GET') return route.abort();
        if (url.pathname === '/1on1') return route.fulfill({ contentType: 'text/html', body: '<a href="/dashboard">Brackets</a><a href="/account">Account</a>' });
        const file = path.resolve('dist', '.' + url.pathname);
        return route.fulfill({ path: fs.existsSync(file) && fs.statSync(file).isFile() ? file : 'dist/index.html' });
      });
      for (const [target, heading] of Object.entries(headings)) {
        await page.goto(site + target);
        if (session === 'valid' && target === '/dashboard') {
          await expectPending();
          assert.equal(new URL(page.url()).pathname, target);
          assert.equal(await page.getByRole('heading', { name: heading, exact: true }).count(), 0);
          release();
        } else release();
        if (session === 'valid') {
          await page.getByRole('heading', { name: heading, exact: true }).waitFor();
          await page.reload();
          await page.getByRole('heading', { name: heading, exact: true }).waitFor();
          await page.goto(site + '/1on1');
          await page.getByRole('link', { name: target === '/dashboard' ? 'Brackets' : 'Account' }).click();
          await page.getByRole('heading', { name: heading, exact: true }).waitFor();
          assert.equal(new URL(page.url()).pathname, target);
        } else {
          await page.waitForURL(site + '/login');
          assert.equal(await page.getByRole('heading', { name: heading, exact: true }).count(), 0);
        }
      }
      if (session === 'valid') {
        await page.goto(site + '/');
        await page.getByRole('link', { name: 'Go to Dashboard', exact: true }).click();
        await page.getByRole('heading', { name: headings['/dashboard'], exact: true }).waitFor();
        await page.getByRole('button', { name: 'Account', exact: true }).filter({ visible: true }).click();
        await page.getByRole('heading', { name: headings['/account'], exact: true }).waitFor();
      }
      assert.deepEqual(failures, []);
      await context.close();
      console.log(session + ' PASS');

      async function expectPending() {
        for (let i = 0; !pending && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(pending, true);
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
