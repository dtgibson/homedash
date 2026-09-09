import { expect, test } from '@playwright/test'

const now = new Date().toISOString()
const meta = {
  generatedAt: now,
  sourceUpdatedAt: now,
  freshness: 'fresh',
  staleAfterMs: 60_000,
  issues: [],
}

const targetNames = [
  'American Redstart',
  'Blackburnian Warbler',
  'California Thrasher',
  'Baird’s Sandpiper',
  'Ruff',
]

const bookmarkNames = ['Gmail', 'Calendar', 'GitHub', 'eBird', 'Macaulay Library']

function requestGate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

function bookmarkSnapshot(
  bookmarks: Array<{ id: string; group: string; name: string; url: string; order: number }>,
) {
  return {
    schemaVersion: 1,
    data: { bookmarks, invalidEntryCount: 0 },
    meta,
  }
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:1910' })
  await context.setGeolocation({ latitude: 37.77, longitude: -122.42 })

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body: unknown
    if (path === '/api/weather') {
      body = {
        schemaVersion: 1,
        data: {
          temperatureUnit: 'fahrenheit',
          timeZone: 'America/Los_Angeles',
          currentTemperature: 58,
          apparentTemperature: 57,
          condition: 'Low clouds, then clear',
          high: 72,
          low: 56,
          precipitationProbability: 8,
          windSpeed: 8,
          sunrise: '2026-09-08T13:46:00.000Z',
          sunset: '2026-09-09T02:35:00.000Z',
          daylightMinutes: 769,
          nextDaylightEvent: { kind: 'sunrise', at: '2026-09-08T13:46:00.000Z' },
          hourly: [
            {
              at: now,
              temperature: 58,
              condition: 'Clouds',
              precipitationProbability: 8,
            },
            {
              at: new Date(Date.parse(now) + 2 * 3_600_000).toISOString(),
              temperature: 63,
              condition: 'Clouds',
              precipitationProbability: 6,
            },
            {
              at: new Date(Date.parse(now) + 4 * 3_600_000).toISOString(),
              temperature: 68,
              condition: 'Clear',
              precipitationProbability: 4,
            },
            {
              at: new Date(Date.parse(now) + 6 * 3_600_000).toISOString(),
              temperature: 72,
              condition: 'Clear',
              precipitationProbability: 2,
            },
            {
              at: new Date(Date.parse(now) + 8 * 3_600_000).toISOString(),
              temperature: 70,
              condition: 'Clear',
              precipitationProbability: 2,
            },
          ],
        },
        meta: {
          ...meta,
          location: { kind: 'current', label: 'Current device location', capturedAt: now },
        },
      }
    } else if (path === '/api/ebird/summary') {
      body = {
        schemaVersion: 1,
        data: {
          radiusKm: 50,
          windowDays: 14,
          targets: {
            lifer: [
              {
                speciesCode: 'amered',
                commonName: 'American Redstart',
                observedAt: now,
                locality: 'Nearby park',
                distanceKm: 2.1,
              },
              {
                speciesCode: 'bkbwar',
                commonName: 'Blackburnian Warbler',
                observedAt: now,
                locality: 'Golden Gate Park · Lily Pond',
                distanceKm: 4.7,
              },
              {
                speciesCode: 'calthr',
                commonName: 'California Thrasher',
                observedAt: now,
                locality: 'Fort Funston',
                distanceKm: 11,
              },
              {
                speciesCode: 'baisan',
                commonName: 'Baird’s Sandpiper',
                observedAt: now,
                locality: 'Hayward Regional Shoreline',
                distanceKm: 27,
              },
              {
                speciesCode: 'ruff',
                commonName: 'Ruff',
                observedAt: now,
                locality: 'Don Edwards NWR · Alviso',
                distanceKm: 49,
              },
            ],
            photo: [],
            audio: [],
          },
          targetAvailability: { lifer: true, photo: true, audio: true },
          month: {
            label: 'September',
            throughDay: 8,
            currentCount: 94,
            previousCount: 87,
            difference: 7,
          },
          nearbyUpdatedAt: now,
          profileUpdatedAt: now,
        },
        meta: {
          ...meta,
          location: { kind: 'current', label: 'Current device location', capturedAt: now },
        },
      }
    } else if (path === '/api/llmdash/summary') {
      const window = { remainingPct: 68, resetsAt: now, capturedAt: now }
      body = {
        schemaVersion: 1,
        data: {
          generatedAt: now,
          providers: [
            {
              id: 'claude',
              label: 'Claude Code',
              fiveHour: window,
              weekly: window,
              diagnostic: null,
            },
            {
              id: 'codex',
              label: 'Codex',
              fiveHour: { ...window, remainingPct: 22 },
              weekly: { ...window, remainingPct: 63 },
              diagnostic: null,
            },
          ],
        },
        meta,
      }
    } else {
      body = {
        schemaVersion: 1,
        data: {
          bookmarks: [
            {
              id: 'gmail',
              group: 'Daily',
              name: 'Gmail',
              url: 'https://mail.google.com',
              order: 0,
            },
            {
              id: 'calendar',
              group: 'Daily',
              name: 'Calendar',
              url: 'https://calendar.google.com',
              order: 1,
            },
            {
              id: 'github',
              group: 'Projects',
              name: 'GitHub',
              url: 'https://github.com',
              order: 2,
            },
            {
              id: 'ebird',
              group: 'Birding',
              name: 'eBird',
              url: 'https://ebird.org',
              order: 3,
            },
            {
              id: 'macaulay',
              group: 'Birding',
              name: 'Macaulay Library',
              url: 'https://macaulaylibrary.org',
              order: 4,
            },
          ],
          invalidEntryCount: 0,
        },
        meta,
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
})

test('Dawn and Dense show the same sources and persist device preferences', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'The day ahead' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Birding pulse' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Coding runway' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Places to go' })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Kagi' })).toBeFocused()
  await expect(page.getByRole('search', { name: 'Kagi web search' })).toHaveAttribute(
    'action',
    'https://kagi.com/search',
  )
  await expect(
    page.getByRole('link', { name: 'Open My eBird for September progress' }),
  ).toHaveAttribute('href', '/launch/ebird/my-ebird')
  await expect(
    page.getByRole('link', { name: 'Open eBird map for American Redstart' }),
  ).toHaveAttribute('href', '/launch/ebird/map/amered')
  await expect(page.getByRole('link', { name: 'Open llmdash dashboard' })).toHaveAttribute(
    'href',
    '/launch/llmdash',
  )
  await expect(page.getByText('within 31 mi · closest first')).toBeVisible()
  await expect(page.getByText('1.3 mi')).toBeVisible()
  for (const name of [...targetNames, ...bookmarkNames]) {
    await expect(page.locator('main')).toContainText(name)
  }

  const mastheadIsContained = await page.evaluate(() => {
    const lede = document.querySelector('.lede')?.getBoundingClientRect()
    const daylight = document.querySelector('.sun-arc')?.getBoundingClientRect()
    return Boolean(lede && daylight && lede.right <= daylight.left + 0.5)
  })
  expect(mastheadIsContained).toBe(true)

  const dawnFit = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight <= document.documentElement.clientHeight,
    documentWidth: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    clippedRegions: [...document.querySelectorAll<HTMLElement>('.story, .utility-section')]
      .filter(
        (element) =>
          element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      )
      .map((element) => ({
        name: element.className,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      })),
    outOfViewportContent: [
      ...document.querySelectorAll<HTMLElement>('.target-item, .provider, .bookmark-group a'),
    ]
      .filter((element) => {
        const bounds = element.getBoundingClientRect()
        const focusAllowance = element.matches('a, button') ? 5 : 0
        return (
          bounds.top - focusAllowance < 50 ||
          bounds.bottom + focusAllowance > window.innerHeight ||
          bounds.right + focusAllowance > window.innerWidth
        )
      })
      .map((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          text: element.textContent?.trim(),
          top: Math.round(bounds.top),
          bottom: Math.round(bounds.bottom),
        }
      }),
  }))
  expect(dawnFit).toEqual({
    documentHeight: true,
    documentWidth: true,
    clippedRegions: [],
    outOfViewportContent: [],
  })
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-dawn.png`),
    fullPage: true,
  })

  await page.getByRole('radio', { name: 'Use Dense display mode' }).click()
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible()
  for (const name of [...targetNames, ...bookmarkNames]) {
    await expect(page.locator('main')).toContainText(name)
  }
  await expect(page.getByText('58°').first()).toBeVisible()
  await expect(page.getByText('daylight 12h 49m')).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Open My eBird for September progress' }),
  ).toHaveAttribute('href', '/launch/ebird/my-ebird')
  await expect(
    page.getByRole('link', { name: 'Open eBird map for American Redstart' }),
  ).toHaveAttribute('href', '/launch/ebird/map/amered')
  await expect(page.getByRole('link', { name: 'Open llmdash dashboard' })).toHaveAttribute(
    'href',
    '/launch/llmdash',
  )

  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Use Dense display mode' })).toBeChecked()

  const denseFit = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight <= document.documentElement.clientHeight,
    documentWidth: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    clippedRegions: [...document.querySelectorAll<HTMLElement>('.dense-row')]
      .filter(
        (element) =>
          element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
      )
      .map((element) => ({
        name: element.getAttribute('aria-labelledby'),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      })),
    outOfViewportContent: [
      ...document.querySelectorAll<HTMLElement>(
        '.target-item, .dense-provider, .dense-bookmarks a',
      ),
    ]
      .filter((element) => {
        const bounds = element.getBoundingClientRect()
        return (
          bounds.top < 50 || bounds.bottom > window.innerHeight || bounds.right > window.innerWidth
        )
      })
      .map((element) => {
        const bounds = element.getBoundingClientRect()
        return {
          text: element.textContent?.trim(),
          top: Math.round(bounds.top),
          bottom: Math.round(bounds.bottom),
        }
      }),
  }))
  expect(denseFit).toEqual({
    documentHeight: true,
    documentWidth: true,
    clippedRegions: [],
    outOfViewportContent: [],
  })
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-dense.png`),
    fullPage: true,
  })
})

test('saved readings paint before independent refreshes settle and survive a failed source', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()
  await expect(page.getByText('58°').first()).toBeVisible()

  const gates = {
    weather: requestGate(),
    bookmarks: requestGate(),
    ebird: requestGate(),
    llmdash: requestGate(),
  }
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/bookmarks') {
      await gates.bookmarks.promise
      await route.fallback()
      return
    }
    if (path === '/api/llmdash/summary') {
      await gates.llmdash.promise
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'llmdash refresh timed out.' }),
      })
      return
    }
    if (path === '/api/weather') await gates.weather.promise
    if (path === '/api/ebird/summary') await gates.ebird.promise
    await route.fallback()
  })

  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByText('58°').first()).toBeVisible()
  await expect(page.getByText('American Redstart')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Gmail' })).toBeVisible()
  await expect(page.getByText('68%').first()).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: 'Refreshing 0 of 4 sources; saved readings remain visible',
    }),
  ).toBeDisabled()
  await expect(page.getByRole('status', { name: /Refreshing/ })).toHaveCount(4)

  gates.bookmarks.release()
  await expect(
    page.getByRole('button', {
      name: 'Refreshing 1 of 4 sources; saved readings remain visible',
    }),
  ).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Gmail' })).toBeVisible()

  gates.llmdash.release()
  await expect(page.getByRole('status', { name: /Refresh failed/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try llmdash again' })).toBeVisible()
  await expect(page.getByText('68%').first()).toBeVisible()
  if (testInfo.project.name === 'mobile-chromium') {
    const retryBounds = await page
      .getByRole('button', { name: 'Try llmdash again' })
      .evaluate((element) => {
        const rectangle = element.getBoundingClientRect()
        return { width: rectangle.width, height: rectangle.height }
      })
    expect(retryBounds.width).toBeGreaterThanOrEqual(44)
    expect(retryBounds.height).toBeGreaterThanOrEqual(44)
  }

  await page.getByRole('radio', { name: 'Use Dense display mode' }).click()
  await expect(page.getByText('58°').first()).toBeVisible()
  await expect(page.getByRole('status', { name: /Refreshing/ })).toHaveCount(2)
  await expect(page.getByRole('status', { name: /Refresh failed/ })).toBeVisible()

  gates.weather.release()
  gates.ebird.release()
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()
  await expect(page.getByRole('status', { name: /Up to date/ })).toHaveCount(3)
  await expect(page.getByRole('status', { name: /Refresh failed/ })).toHaveCount(1)
})

test('a poisoned bookmark snapshot renders no link before a valid live response', async ({
  page,
}) => {
  const gate = requestGate()
  await page.route('**/api/bookmarks', async (route) => {
    await gate.promise
    await route.fallback()
  })
  await page.addInitScript(
    (snapshot) => {
      localStorage.setItem('homedash.cache.bookmarks.v1', JSON.stringify(snapshot))
    },
    bookmarkSnapshot([
      {
        id: 'poisoned',
        group: 'Daily',
        name: 'Poisoned bookmark',
        url: 'javascript:alert(document.domain)',
        order: 0,
      },
    ]),
  )

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Poisoned bookmark' })).toHaveCount(0)
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Reading bookmark configuration…' })).toBeVisible()

  gate.release()
  const liveBookmark = page.getByRole('link', { name: 'Gmail' })
  await expect(liveBookmark).toHaveAttribute('href', 'https://mail.google.com')
  await page.getByRole('radio', { name: 'Use Dense display mode' }).click()
  await expect(liveBookmark).toHaveAttribute('href', 'https://mail.google.com')
})

test('a valid cached HTTP(S) bookmark renders unchanged in Dawn and Dense', async ({ page }) => {
  const gate = requestGate()
  await page.route('**/api/bookmarks', async (route) => {
    await gate.promise
    await route.fallback()
  })
  await page.addInitScript(
    (snapshot) => {
      localStorage.setItem('homedash.cache.bookmarks.v1', JSON.stringify(snapshot))
    },
    bookmarkSnapshot([
      {
        id: 'safe-cached',
        group: 'Daily',
        name: 'Safe cached bookmark',
        url: 'https://example.com/deep?bird=ruff#photos',
        order: 0,
      },
    ]),
  )

  await page.goto('/')
  const cachedBookmark = page.getByRole('link', { name: 'Safe cached bookmark' })
  await expect(cachedBookmark).toHaveAttribute('href', 'https://example.com/deep?bird=ruff#photos')
  await page.getByRole('radio', { name: 'Use Dense display mode' }).click()
  await expect(cachedBookmark).toHaveAttribute('href', 'https://example.com/deep?bird=ruff#photos')

  gate.release()
  await expect(page.getByRole('link', { name: 'Gmail' })).toBeVisible()
})

test('global refresh keeps focus and ignores duplicate pointer and keyboard activation', async ({
  page,
}) => {
  await page.goto('/')
  const idleRefresh = page.getByRole('button', {
    name: 'Refresh weather, bookmarks, eBird, and llmdash data',
  })
  await expect(idleRefresh).toBeEnabled()

  const gate = requestGate()
  const refreshRequests: string[] = []
  await page.route('**/api/**', async (route) => {
    if (route.request().headers()['x-homedash-refresh'] === '1') {
      refreshRequests.push(new URL(route.request().url()).pathname)
      await gate.promise
    }
    await route.fallback()
  })

  await idleRefresh.click()
  const busyRefresh = page.getByRole('button', {
    name: 'Refreshing 0 of 4 sources; saved readings remain visible',
  })
  await expect(busyRefresh).toBeFocused()
  await expect(busyRefresh).toHaveAttribute('aria-busy', 'true')
  await expect(busyRefresh).toHaveAttribute('aria-disabled', 'true')
  await expect
    .poll(() => refreshRequests.sort())
    .toEqual(['/api/bookmarks', '/api/ebird/summary', '/api/llmdash/summary', '/api/weather'])

  const bounds = await busyRefresh.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)
  await page.keyboard.press('Enter')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
  expect(refreshRequests).toHaveLength(4)
  await expect(busyRefresh).toBeFocused()

  gate.release()
  await expect(idleRefresh).toBeEnabled()
  await expect(idleRefresh).toHaveAttribute('aria-busy', 'false')
  await expect(idleRefresh).toHaveAttribute('aria-disabled', 'false')
  await expect(idleRefresh).toBeFocused()
})

test('Kagi query stays ephemeral, trims on submit, and focus is not reclaimed', async ({
  page,
}) => {
  await page.goto('/')
  const query = page.getByRole('searchbox', { name: 'Kagi' })
  await expect(query).toBeFocused()
  await query.fill('  sandhill crane  ')
  await page.getByRole('radio', { name: 'Use Dense display mode' }).click()
  await expect(query).toHaveValue('  sandhill crane  ')
  await expect(page.getByRole('search')).toHaveCount(1)
  await expect(page.getByRole('radio', { name: 'Use Dense display mode' })).toBeFocused()

  await page.evaluate(() => {
    document
      .querySelector<HTMLFormElement>('.kagi-form')
      ?.addEventListener('submit', (event) => event.preventDefault(), { once: true })
  })
  await query.press('Enter')
  await expect(query).toHaveValue('sandhill crane')

  await query.fill('   ')
  await query.press('Enter')
  await expect(query).toHaveValue('')
  await expect(page.getByText('Enter a search before going to Kagi.')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('kagi') ?? '')).toBe('')
})

test('named mobile controls keep a 44 by 44 touch baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile touch-target coverage')

  const expectTouchTarget = async (label: string, locator: ReturnType<typeof page.getByRole>) => {
    const bounds = await locator.evaluate((element) => {
      const rectangle = element.getBoundingClientRect()
      return { width: rectangle.width, height: rectangle.height }
    })
    expect(bounds.width, `${label} width`).toBeGreaterThanOrEqual(44)
    expect(bounds.height, `${label} height`).toBeGreaterThanOrEqual(44)
  }

  await page.goto('/')
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()

  for (const name of [
    'Use Dawn display mode',
    'Use Dense display mode',
    'System',
    'Light',
    'Dark',
  ]) {
    await expectTouchTarget(name, page.getByRole('radio', { name, exact: true }))
  }
  for (const name of bookmarkNames) {
    await expectTouchTarget(name, page.getByRole('link', { name, exact: true }))
  }

  await page.getByRole('radio', { name: 'Use Dense display mode' }).click()
  for (const name of [/Lifers/, /Photo/, /Audio/]) {
    await expectTouchTarget(String(name), page.getByRole('radio', { name }))
  }

  await page.evaluate(() => localStorage.removeItem('homedash.cache.bookmarks.v1'))
  await page.route('**/api/bookmarks', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Bookmark configuration is temporarily unavailable.' }),
    })
  })
  await page.reload()

  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible()
  await expectTouchTarget('Empty bookmarks retry', retry)
})
