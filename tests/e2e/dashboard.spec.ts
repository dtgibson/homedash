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

test('source retry controls keep their mobile touch baseline', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile touch-target coverage')

  await page.route('**/api/bookmarks', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Bookmark configuration is temporarily unavailable.' }),
    })
  })
  await page.goto('/')

  const retry = page.getByRole('button', { name: 'Try again' })
  await expect(retry).toBeVisible()
  expect(
    await retry.evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(40)
})
