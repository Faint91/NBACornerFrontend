const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { chromium } = require(require.resolve('@playwright/test', {
  paths: [process.env.PLAYWRIGHT_DEPENDENCIES || process.cwd()],
}));
const site = 'https://www.nbacorner.com';
const api = 'http://127.0.0.1:3400';
const user = { id: 'fixture', username: 'Fixture', is_admin: false };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

async function openFixture(browser, width, session) {
  const context = await browser.newContext({ viewport: { width, height: 740 }, serviceWorkers: 'block' });
  if (session) await context.addInitScript(({ user, session }) => {
    localStorage.setItem('auth_token', 'synthetic-session');
    localStorage.setItem('auth_user', session === 'broken' ? '{' : JSON.stringify(user));
  }, { user, session });
  const reads = [];
  const writes = [];
  const documents = [];
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === api) {
      const headers = { 'Access-Control-Allow-Origin': site, 'Access-Control-Allow-Headers': 'authorization,content-type' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (req.method() !== 'GET') {
        writes.push(url.pathname);
        return route.abort();
      }
      reads.push(url.pathname);
      let json = [];
      if (url.pathname === '/leagues/me') json = { leagues: [] };
      if (url.pathname === '/brackets/me') json = { bracket: null, playoffs_locked: false, bracket_creation_open: false };
      if (url.pathname.endsWith('/bracket/fixture')) {
        json = { bracket: { id: 'fixture', name: 'Fixture bracket', user_id: user.id, is_done: false, is_owner: true, read_only: url.pathname.startsWith('/history'), is_historical: url.pathname.startsWith('/history') }, matches: {} };
      }
      return route.fulfill({ headers, json });
    }
    if (url.origin !== site || req.method() !== 'GET') return route.abort();
    if (req.isNavigationRequest()) documents.push(url.pathname);
    if (url.pathname === '/1on1') return route.fulfill({ contentType: 'text/html', body: '<a href="/#brackets">Explore NBA Playoff Brackets</a>' });
    const asset = path.resolve('dist', '.' + url.pathname);
    const file = fs.existsSync(asset) && fs.statSync(asset).isFile() ? asset : path.resolve('dist/index.html');
    return route.fulfill({ path: file, contentType: mime[path.extname(file)] });
  });
  return { context, page: await context.newPage(), reads, writes, documents };
}

async function anchorVisible(page) {
  await page.getByRole('heading', { name: 'NBA Playoff Brackets' }).waitFor();
  await page.waitForFunction(() => {
    const heading = document.querySelector('#brackets h2').getBoundingClientRect();
    return location.hash === '#brackets' && scrollY > 0 && heading.top >= 0 && heading.bottom <= innerHeight;
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    for (const width of [320, 390, 768, 1440]) {
      for (const session of ['guest', 'registered']) {
        const { context, page, reads, writes } = await openFixture(browser, width, session === 'registered' ? session : null);
        await page.goto(site + '/');
        await page.getByRole('heading', { level: 1, name: 'NBA Corner' }).waitFor();
        assert.equal(new URL(page.url()).pathname, '/');
        const daily = page.getByRole('region', { name: 'Daily 1on1' }).getByRole('link');
        assert.equal(await daily.getAttribute('href'), '/1on1');
        const section = page.getByRole('region', { name: 'NBA Playoff Brackets' });
        const action = section.getByRole('link', { name: session === 'registered' ? 'Go to Dashboard' : 'Sign In', exact: true });
        await action.waitFor();
        assert.equal(await action.getAttribute('href'), session === 'registered' ? '/dashboard' : '/login');
        if (session === 'guest') assert.equal(await section.getByRole('link', { name: 'Create Account' }).getAttribute('href'), '/register');
        const menu = page.getByRole('button', { name: 'Menu', exact: true });
        if (width < 768) {
          await menu.focus();
          await page.keyboard.press('Enter');
          await page.getByRole('navigation').filter({ visible: true }).first().getByRole('link', { name: 'Daily 1on1' }).waitFor();
          await menu.click();
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.getByRole('contentinfo').getByRole('link', { name: 'FAQs' }).waitFor();
        await daily.click();
        await page.waitForURL(site + '/1on1');
        await page.getByRole('link', { name: 'Explore NBA Playoff Brackets' }).click();
        await anchorVisible(page);
        await page.reload();
        await anchorVisible(page);
        assert.deepEqual(reads, []);
        assert.deepEqual(writes, []);
        await context.close();
        console.log(width, session, 'homepage, Daily handoff, anchor and reload PASS');
      }
    }

    const broken = await openFixture(browser, 390, 'broken');
    await broken.page.goto(site + '/#brackets');
    await anchorVisible(broken.page);
    await broken.page.getByRole('region', { name: 'NBA Playoff Brackets' }).getByRole('link', { name: 'Sign In', exact: true }).waitFor();
    assert.deepEqual(broken.reads, []);
    await broken.context.close();
    const anonymous = await openFixture(browser, 390, null);
    for (const route of ['/dashboard', '/account', '/bracket/fixture', '/leagues/info']) {
      await anonymous.page.goto(site + route);
      await anonymous.page.waitForURL(site + '/login');
    }
    assert.deepEqual(anonymous.reads, []);
    await anonymous.page.goto(site + '/history/bracket/fixture');
    await anonymous.page.getByRole('link', { name: 'Play Daily 1on1' }).waitFor();
    assert.ok(anonymous.reads.includes('/history/bracket/fixture'));
    await anonymous.context.close();
    console.log('Malformed session fallback, protected pages and historical bracket PASS');

    const registered = await openFixture(browser, 390, 'registered');
    await registered.page.goto(site);
    await registered.page.getByRole('link', { name: 'Go to Dashboard' }).click();
    await registered.page.waitForURL(site + '/dashboard');
    await registered.page.getByRole('heading', { name: 'Playoff Brackets' }).waitFor();
    await registered.page.getByRole('link', { name: 'Play Today’s 1on1' }).waitFor();
    assert.ok(registered.reads.includes('/brackets/me'));
    assert.ok(registered.reads.includes('/leagues/me'));
    // Navigate within the mounted SPA so the existing protected route sees the restored session.
    await registered.page.evaluate(() => {
      history.pushState(null, '', '/bracket/fixture');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await registered.page.getByRole('link', { name: 'Play Daily 1on1' }).waitFor();
    assert.ok(registered.reads.includes('/bracket/fixture'));
    assert.deepEqual(registered.writes, []);
    await registered.context.close();
    console.log('Dashboard and authenticated current bracket PASS');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
