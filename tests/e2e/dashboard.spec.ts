import { expect, test, type Page } from '@playwright/test'

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
    data: {
      sections: [...new Set(bookmarks.map((bookmark) => bookmark.group))],
      bookmarks,
      invalidEntryCount: 0,
    },
    meta,
  }
}

const defaultBookmarkDocument = {
  schemaVersion: 1 as const,
  sections: [
    {
      name: 'Daily',
      bookmarks: [
        { name: 'Gmail', url: 'https://mail.google.com' },
        { name: 'Calendar', url: 'https://calendar.google.com' },
      ],
    },
    { name: 'Projects', bookmarks: [{ name: 'GitHub', url: 'https://github.com' }] },
    {
      name: 'Birding',
      bookmarks: [
        { name: 'eBird', url: 'https://ebird.org' },
        { name: 'Macaulay Library', url: 'https://macaulaylibrary.org' },
      ],
    },
  ],
}

function bookmarkDocumentResponse(
  document: typeof defaultBookmarkDocument = defaultBookmarkDocument,
  revisionCharacter = 'a',
) {
  let order = 0
  const bookmarks = document.sections.flatMap((section) =>
    section.bookmarks.map((bookmark) => {
      order += 1
      return {
        id: order.toString(16).padStart(16, '0'),
        group: section.name,
        name: bookmark.name,
        url: bookmark.url,
        order: order - 1,
      }
    }),
  )
  const display = bookmarkSnapshot(bookmarks)
  display.data.sections = document.sections.map((section) => section.name)
  return {
    schemaVersion: 1,
    revision: `sha256:${revisionCharacter.repeat(64)}`,
    document,
    display,
  }
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Settings' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Shared bookmarks')).toBeVisible()
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)).then(
      () => undefined,
    ),
  )
  return dialog
}

async function closeSettings(page: Page) {
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByRole('button', { name: 'Close' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0)
}

async function selectMode(page: Page, mode: 'Dawn' | 'Dense') {
  const dialog = await openSettings(page)
  await dialog.getByRole('radio', { name: mode, exact: true }).click()
  await closeSettings(page)
}

async function selectAppearance(page: Page, appearance: 'System' | 'Light' | 'Dark') {
  const dialog = await openSettings(page)
  await dialog.getByRole('radio', { name: appearance, exact: true }).click()
  await closeSettings(page)
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:1910' })
  await context.setGeolocation({ latitude: 37.77, longitude: -122.42 })

  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let body: unknown
    if (path === '/api/bookmarks/document') {
      const candidate =
        route.request().method() === 'PUT'
          ? ((route.request().postDataJSON() as { document?: typeof defaultBookmarkDocument })
              .document ?? defaultBookmarkDocument)
          : defaultBookmarkDocument
      body = bookmarkDocumentResponse(candidate, route.request().method() === 'PUT' ? 'b' : 'a')
    } else if (/^\/api\/bookmarks\/[^/]+\/favicon$/.test(path)) {
      await route.fulfill({ status: 404, headers: { 'cache-control': 'private, max-age=900' } })
      return
    } else if (path === '/api/tide') {
      body = {
        schemaVersion: 1,
        data: {
          station: { label: 'Alameda', datum: 'MLLW', units: 'feet' },
          current: {
            at: now,
            heightFeet: 2.1,
            basis: 'observed',
            direction: 'rising',
          },
          nextTurn: {
            kind: 'high',
            at: new Date(Date.parse(now) + 3 * 3_600_000).toISOString(),
            heightFeet: 5.4,
          },
          predictions: [
            { at: new Date(Date.parse(now) - 8 * 3_600_000).toISOString(), heightFeet: 0.6 },
            { at: new Date(Date.parse(now) - 3 * 3_600_000).toISOString(), heightFeet: 1.1 },
            { at: now, heightFeet: 2.1 },
            { at: new Date(Date.parse(now) + 3 * 3_600_000).toISOString(), heightFeet: 5.4 },
            { at: new Date(Date.parse(now) + 8 * 3_600_000).toISOString(), heightFeet: 1.0 },
          ],
          turns: [
            {
              kind: 'low',
              at: new Date(Date.parse(now) - 3 * 3_600_000).toISOString(),
              heightFeet: 1.1,
            },
            {
              kind: 'high',
              at: new Date(Date.parse(now) + 3 * 3_600_000).toISOString(),
              heightFeet: 5.4,
            },
          ],
        },
        meta: { ...meta, staleAfterMs: 900_000 },
      }
    } else if (path === '/api/weather') {
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
          radiusKm: 16,
          windowDays: 14,
          targets: {
            lifer: [
              {
                speciesCode: 'amered',
                commonName: 'American Redstart',
                observedAt: '2026-09-10T05:00:00.000Z',
                locality: 'Nearby park',
                distanceKm: 2.1,
              },
              {
                speciesCode: 'bkbwar',
                commonName: 'Blackburnian Warbler',
                observedAt: '2026-09-10T06:00:00.000Z',
                locality: 'Golden Gate Park · Lily Pond',
                distanceKm: 4.7,
              },
              {
                speciesCode: 'calthr',
                commonName: 'California Thrasher',
                observedAt: '2026-09-10T07:00:00.000Z',
                locality: 'Fort Funston',
                distanceKm: 11,
              },
              {
                speciesCode: 'baisan',
                commonName: 'Baird’s Sandpiper',
                observedAt: '2026-09-10T08:00:00.000Z',
                locality: 'Hayward Regional Shoreline',
                distanceKm: 27,
              },
              {
                speciesCode: 'ruff',
                commonName: 'Ruff',
                observedAt: '2026-09-10T09:00:00.000Z',
                locality: 'Don Edwards NWR · Alviso',
                distanceKm: 49,
              },
            ],
            photo: [],
            audio: [],
          },
          targetOrders: {
            distance: {
              lifer: [
                {
                  speciesCode: 'amered',
                  commonName: 'American Redstart',
                  observedAt: '2026-09-10T05:00:00.000Z',
                  locality: 'Nearby park',
                  distanceKm: 2.1,
                },
                {
                  speciesCode: 'bkbwar',
                  commonName: 'Blackburnian Warbler',
                  observedAt: '2026-09-10T06:00:00.000Z',
                  locality: 'Golden Gate Park · Lily Pond',
                  distanceKm: 4.7,
                },
                {
                  speciesCode: 'calthr',
                  commonName: 'California Thrasher',
                  observedAt: '2026-09-10T07:00:00.000Z',
                  locality: 'Fort Funston',
                  distanceKm: 11,
                },
                {
                  speciesCode: 'baisan',
                  commonName: 'Baird’s Sandpiper',
                  observedAt: '2026-09-10T08:00:00.000Z',
                  locality: 'Hayward Regional Shoreline',
                  distanceKm: 27,
                },
                {
                  speciesCode: 'ruff',
                  commonName: 'Ruff',
                  observedAt: '2026-09-10T09:00:00.000Z',
                  locality: 'Don Edwards NWR · Alviso',
                  distanceKm: 49,
                },
              ],
              photo: [],
              audio: [],
            },
            recent: {
              lifer: [
                {
                  speciesCode: 'ruff',
                  commonName: 'Ruff',
                  observedAt: '2026-09-10T09:00:00.000Z',
                  locality: 'Don Edwards NWR · Alviso',
                  distanceKm: 49,
                },
                {
                  speciesCode: 'baisan',
                  commonName: 'Baird’s Sandpiper',
                  observedAt: '2026-09-10T08:00:00.000Z',
                  locality: 'Hayward Regional Shoreline',
                  distanceKm: 27,
                },
                {
                  speciesCode: 'calthr',
                  commonName: 'California Thrasher',
                  observedAt: '2026-09-10T07:00:00.000Z',
                  locality: 'Fort Funston',
                  distanceKm: 11,
                },
                {
                  speciesCode: 'bkbwar',
                  commonName: 'Blackburnian Warbler',
                  observedAt: '2026-09-10T06:00:00.000Z',
                  locality: 'Golden Gate Park · Lily Pond',
                  distanceKm: 4.7,
                },
                {
                  speciesCode: 'amered',
                  commonName: 'American Redstart',
                  observedAt: '2026-09-10T05:00:00.000Z',
                  locality: 'Nearby park',
                  distanceKm: 2.1,
                },
              ],
              photo: [],
              audio: [],
            },
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
          sections: ['Daily', 'Projects', 'Birding'],
          bookmarks: [
            {
              id: '0000000000000001',
              group: 'Daily',
              name: 'Gmail',
              url: 'https://mail.google.com',
              order: 0,
            },
            {
              id: '0000000000000002',
              group: 'Daily',
              name: 'Calendar',
              url: 'https://calendar.google.com',
              order: 1,
            },
            {
              id: '0000000000000003',
              group: 'Projects',
              name: 'GitHub',
              url: 'https://github.com',
              order: 2,
            },
            {
              id: '0000000000000004',
              group: 'Birding',
              name: 'eBird',
              url: 'https://ebird.org',
              order: 3,
            },
            {
              id: '0000000000000005',
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
  await expect(page.locator('.coastal-graphic')).toHaveAccessibleName(
    /Current tide 2\.1 ft observed, rising\. Next high 5\.4 ft/i,
  )
  await expect(page.locator('.tide-current-point')).toBeVisible()
  await expect(page.locator('.tide-turn-point')).toBeVisible()
  await expect(page.locator('.coastal-graphic .tide-facts-full')).toContainText('Alameda · MLLW')
  const kagiQuery = page.getByRole('searchbox', { name: 'Kagi' })
  await expect(kagiQuery).toBeFocused()
  const kagiFocusTreatment = await kagiQuery.evaluate((input) => {
    const style = getComputedStyle(input)
    return { outlineStyle: style.outlineStyle, boxShadow: style.boxShadow }
  })
  expect(kagiFocusTreatment.outlineStyle).toBe('none')
  expect(kagiFocusTreatment.boxShadow).toContain('inset')
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
  await expect(page.getByText('within 10 mi')).toBeVisible()
  await expect(page.getByText('1.3 mi')).toBeVisible()
  for (const name of [...targetNames, ...bookmarkNames]) {
    await expect(page.locator('main')).toContainText(name)
  }

  let sortEbirdRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/ebird/summary') sortEbirdRequests += 1
  })
  await expect(page.getByRole('radio', { name: 'Nearest' })).toBeChecked()
  const recentOrder = page.getByRole('radio', { name: 'Recent' })
  await recentOrder.click()
  await expect(recentOrder).toBeChecked()
  await expect(recentOrder).toBeFocused()
  await expect(page.locator('.target-list .target-item strong').first()).toHaveText('Ruff')
  expect(sortEbirdRequests).toBe(0)

  const mastheadIsContained = await page.evaluate(() => {
    const lede = document.querySelector('.lede')?.getBoundingClientRect()
    const daylight = document.querySelector('.coastal-day')?.getBoundingClientRect()
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

  const settings = await openSettings(page)
  await settings.getByRole('radio', { name: 'Dense', exact: true }).click()
  await closeSettings(page)
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Recent' })).toBeChecked()
  await expect(page.locator('.dense-tide-line')).toHaveAccessibleName(
    /Tide 2\.1 ft observed, rising\. Next high 5\.4 ft/i,
  )
  await expect(page.locator('.dense-tide-trace')).toBeVisible()
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

  const appearanceSettings = await openSettings(page)
  await appearanceSettings.getByRole('radio', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark')
  await closeSettings(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Recent' })).toBeChecked()
  await expect(kagiQuery).toBeFocused()
  const persistedKagiFocusTreatment = await kagiQuery.evaluate((input) => {
    const style = getComputedStyle(input)
    return { outlineStyle: style.outlineStyle, boxShadow: style.boxShadow }
  })
  expect(persistedKagiFocusTreatment.outlineStyle).toBe('none')
  expect(persistedKagiFocusTreatment.boxShadow).toContain('inset')
  const persistedSettings = await openSettings(page)
  await expect(persistedSettings.getByRole('radio', { name: 'Dense', exact: true })).toBeChecked()
  await closeSettings(page)

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

test('Settings stages and confirms bookmark changes in a contained modal', async ({
  page,
}, testInfo) => {
  let currentDocument = structuredClone(defaultBookmarkDocument)
  let putRequest:
    | {
        headers: Record<string, string>
        body: { baseRevision: string; document: typeof defaultBookmarkDocument }
      }
    | undefined
  await page.route('**/api/bookmarks/document', async (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as {
        baseRevision: string
        document: typeof defaultBookmarkDocument
      }
      putRequest = { headers: await route.request().allHeaders(), body }
      currentDocument = body.document
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(bookmarkDocumentResponse(currentDocument, 'b')),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(bookmarkDocumentResponse(currentDocument)),
    })
  })

  const refreshedSources: string[] = []
  let watchSources = false
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (
      watchSources &&
      [
        '/api/weather',
        '/api/tide',
        '/api/bookmarks',
        '/api/ebird/summary',
        '/api/llmdash/summary',
      ].includes(path)
    ) {
      refreshedSources.push(path)
    }
  })

  await page.goto('/')
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()
  const dialog = await openSettings(page)
  await expect(dialog.getByLabel('Section name').first()).toHaveValue('Daily')
  await expect(dialog).toHaveAccessibleDescription(
    /View and appearance stay on this browser.*every device connected through your tailnet/,
  )
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  await expect(page.getByRole('main')).toHaveCount(0)
  await expect(page.locator('main')).toHaveCount(1)
  await expect(page.locator('.shell')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.shell')).toHaveAttribute('inert', '')
  expect(await page.locator('body').getAttribute('data-scroll-locked')).not.toBeNull()

  const modalLayout = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const header = element.querySelector<HTMLElement>('.settings-header')!.getBoundingClientRect()
    const footer = element.querySelector<HTMLElement>('.settings-footer')!.getBoundingClientRect()
    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      headerVisible: header.top >= bounds.top && header.bottom <= bounds.bottom,
      footerVisible: footer.top >= bounds.top && footer.bottom <= bounds.bottom,
      documentWidth: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }
  })
  expect(modalLayout.left).toBeGreaterThanOrEqual(0)
  expect(modalLayout.right).toBeLessThanOrEqual(
    testInfo.project.name === 'mobile-chromium' ? 360 : 1440,
  )
  expect(modalLayout.top).toBeGreaterThanOrEqual(0)
  expect(modalLayout.bottom).toBeLessThanOrEqual(
    testInfo.project.name === 'mobile-chromium' ? 800 : 900,
  )
  expect(modalLayout).toMatchObject({
    headerVisible: true,
    footerVisible: true,
    documentWidth: true,
  })

  await page.locator('.settings-overlay').click({ position: { x: 4, y: 4 }, force: true })
  await expect(dialog).toBeVisible()
  for (let index = 0; index < 20; index += 1) await page.keyboard.press('Tab')
  expect(
    await page.evaluate(() => Boolean(document.activeElement?.closest('.settings-dialog'))),
  ).toBe(true)

  const dailyName = dialog.getByLabel('Section name').first()
  await dailyName.fill('Morning')
  const moveProjects = dialog.getByRole('button', { name: 'Move section Projects up' })
  await moveProjects.click()
  await expect(moveProjects).toBeFocused()
  await dialog.getByRole('button', { name: 'Add section' }).click()
  const emptySection = dialog.getByLabel('Section name').last()
  await expect(emptySection).toBeFocused()
  await emptySection.fill('Empty saved')

  await dialog.getByRole('button', { name: 'Close' }).click()
  const discard = page.getByRole('dialog', { name: 'Discard bookmark changes?' })
  await expect(discard).toBeVisible()
  await discard.getByRole('button', { name: 'Keep editing' }).click()
  await expect(dialog).toBeVisible()

  watchSources = true
  await dialog.getByRole('button', { name: 'Save bookmarks' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0)
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.locator('.shell')).not.toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('.shell')).not.toHaveAttribute('inert', '')
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused()
  await expect(page.getByText('Bookmarks saved.')).toBeVisible()
  expect(putRequest?.headers['x-homedash-bookmark-write']).toBe('1')
  expect(putRequest?.body.baseRevision).toBe(`sha256:${'a'.repeat(64)}`)
  expect(putRequest?.body.document.sections.map((section) => section.name)).toEqual([
    'Projects',
    'Morning',
    'Birding',
    'Empty saved',
  ])
  expect(JSON.stringify(putRequest?.body)).not.toContain('section-')
  expect(JSON.stringify(putRequest?.body)).not.toContain('bookmark-')
  expect(refreshedSources).toEqual([])
  await expect(page.getByRole('heading', { name: 'Empty saved' })).toBeVisible()
  await expect(page.getByText('No bookmarks')).toBeVisible()
  await expect(page.getByText('58°').first()).toBeVisible()

  const reopened = await openSettings(page)
  await expect(reopened.getByLabel('Section name').last()).toHaveValue('Empty saved')
  await closeSettings(page)
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
    tide: requestGate(),
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
    if (path === '/api/tide') await gates.tide.promise
    if (path === '/api/weather') await gates.weather.promise
    if (path === '/api/ebird/summary') await gates.ebird.promise
    await route.fallback()
  })

  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByText('58°').first()).toBeVisible()
  await expect(page.getByText('American Redstart')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Gmail' })).toBeVisible()
  await expect(page.getByText('68%').first()).toBeVisible()
  await expect(page.locator('.coastal-graphic .tide-facts-full')).toContainText('2.1 ft')
  await expect(
    page.getByRole('button', {
      name: 'Refreshing 0 of 5 sources; saved readings remain visible',
    }),
  ).toBeDisabled()
  await expect(page.getByRole('status', { name: /Refreshing/ })).toHaveCount(5)

  gates.tide.release()
  await expect(
    page.getByRole('button', {
      name: 'Refreshing 1 of 5 sources; saved readings remain visible',
    }),
  ).toBeDisabled()
  await expect(page.locator('.coastal-graphic .tide-facts-full')).toContainText('2.1 ft observed')

  gates.bookmarks.release()
  await expect(
    page.getByRole('button', {
      name: 'Refreshing 2 of 5 sources; saved readings remain visible',
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

  await selectMode(page, 'Dense')
  await expect(page.locator('.dense-tide-line')).toHaveAccessibleName(
    /Tide 2\.1 ft observed, rising\. Next high 5\.4 ft/i,
  )
  await expect(page.locator('.dense-tide-trace')).toBeVisible()
  await expect(page.getByText('58°').first()).toBeVisible()
  await expect(page.getByRole('status', { name: /Refreshing/ })).toHaveCount(2)
  await expect(page.getByRole('status', { name: /Refresh failed/ })).toBeVisible()

  gates.weather.release()
  gates.ebird.release()
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()
  await expect(page.getByRole('status', { name: /Up to date/ })).toHaveCount(4)
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
  await selectMode(page, 'Dense')
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
        id: '0123456789abcdef',
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
  await selectMode(page, 'Dense')
  await expect(cachedBookmark).toHaveAttribute('href', 'https://example.com/deep?bird=ruff#photos')

  gate.release()
  await expect(page.getByRole('link', { name: 'Gmail' })).toBeVisible()
})

test('global refresh keeps focus and ignores duplicate pointer and keyboard activation', async ({
  page,
}) => {
  await page.goto('/')
  const idleRefresh = page.getByRole('button', {
    name: 'Refresh weather, tide, bookmarks, eBird, and llmdash data',
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
    name: 'Refreshing 0 of 5 sources; saved readings remain visible',
  })
  await expect(busyRefresh).toBeFocused()
  await expect(busyRefresh).toHaveAttribute('aria-busy', 'true')
  await expect(busyRefresh).toHaveAttribute('aria-disabled', 'true')
  await expect
    .poll(() => refreshRequests.sort())
    .toEqual([
      '/api/bookmarks',
      '/api/ebird/summary',
      '/api/llmdash/summary',
      '/api/tide',
      '/api/weather',
    ])

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
  expect(refreshRequests).toHaveLength(5)
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
  await selectMode(page, 'Dense')
  await expect(query).toHaveValue('  sandhill crane  ')
  await expect(page.getByRole('search')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused()

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

test('named mobile controls and bookmarks keep their touch baselines', async ({
  page,
}, testInfo) => {
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

  await expectTouchTarget('Settings', page.getByRole('button', { name: 'Settings' }))
  const settings = await openSettings(page)
  for (const name of ['Dawn', 'Dense', 'System', 'Light', 'Dark']) {
    await expectTouchTarget(name, settings.getByRole('radio', { name, exact: true }))
  }
  await expectTouchTarget('Add section', settings.getByRole('button', { name: 'Add section' }))
  await expectTouchTarget(
    'Move Daily down',
    settings.getByRole('button', { name: 'Move section Daily down' }),
  )
  await closeSettings(page)
  for (const name of bookmarkNames) {
    const bookmark = page.getByRole('link', { name, exact: true })
    const bounds = await bookmark.evaluate((element) => {
      const rectangle = element.getBoundingClientRect()
      return { width: rectangle.width, height: rectangle.height }
    })
    expect(bounds.width, `${name} width`).toBeGreaterThanOrEqual(48)
    expect(bounds.height, `${name} height`).toBeGreaterThanOrEqual(48)
  }

  await selectMode(page, 'Dense')
  await expectTouchTarget('Nearest', page.getByRole('radio', { name: 'Nearest' }))
  await expectTouchTarget('Recent', page.getByRole('radio', { name: 'Recent' }))
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

test('favicons stay decorative, same-origin, stable, and inside the release viewport matrix', async ({
  page,
}, testInfo) => {
  const validPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  const faviconRequests: string[] = []
  await page.route('**/api/bookmarks/*/favicon', async (route) => {
    const url = new URL(route.request().url())
    faviconRequests.push(url.toString())
    if (url.pathname.includes('0000000000000001') || url.pathname.includes('0000000000000003')) {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'cache-control': 'private, max-age=86400' },
        body: validPng,
      })
      return
    }
    await route.fulfill({ status: 404, headers: { 'cache-control': 'private, max-age=900' } })
  })

  const documentResponse = await page.goto('/')
  expect(documentResponse?.headers()['content-security-policy']).toContain("img-src 'self' data:")
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()
  await expect(page.locator('.bookmark-favicon[data-loaded="true"]')).toHaveCount(2)
  await expect(page.locator('.bookmark-fallback')).toHaveCount(3)

  for (const name of bookmarkNames) {
    const link = page.getByRole('link', { name, exact: true })
    await expect(link).toBeVisible()
    await expect(link.locator('.bookmark-mark')).toHaveAttribute('aria-hidden', 'true')
    await expect(link.locator('.bookmark-favicon')).toHaveCount(
      name === 'Gmail' || name === 'GitHub' ? 1 : 0,
    )
    await expect(link).not.toHaveAttribute('target')
  }
  expect(faviconRequests.length).toBeGreaterThanOrEqual(5)
  expect(
    faviconRequests.every((request) => new URL(request).origin === 'http://127.0.0.1:1910'),
  ).toBe(true)

  const expectedHrefs = [
    'https://mail.google.com/',
    'https://calendar.google.com/',
    'https://github.com/',
    'https://ebird.org/',
    'https://macaulaylibrary.org/',
  ]
  const appearances = ['System', 'Light', 'Dark'] as const
  const modes = ['Dawn', 'Dense'] as const

  for (const mode of modes) {
    await selectMode(page, mode)
    for (const appearance of appearances) {
      await selectAppearance(page, appearance)
      await expect(page.getByRole('link', { name: 'Gmail', exact: true })).toBeVisible()
      const result = await page.evaluate(
        ({ mobile }) => {
          const links = [...document.querySelectorAll<HTMLElement>('.bookmark-link')]
          const rectangles = links.map((element) => element.getBoundingClientRect())
          const overlap = rectangles.some((left, leftIndex) =>
            rectangles.some(
              (right, rightIndex) =>
                rightIndex > leftIndex &&
                Math.min(left.right, right.right) > Math.max(left.left, right.left) &&
                Math.min(left.bottom, right.bottom) > Math.max(left.top, right.top),
            ),
          )
          return {
            names: links.map((element) =>
              element.querySelector<HTMLElement>('.bookmark-name')?.textContent?.trim(),
            ),
            hrefs: links.map((element) => (element as HTMLAnchorElement).href),
            documentWidth:
              document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            documentHeight:
              document.documentElement.scrollHeight <= document.documentElement.clientHeight,
            bookmarkOverflow: [...document.querySelectorAll<HTMLElement>('.bookmark-scroll')]
              .filter(
                (element) =>
                  element.scrollWidth > element.clientWidth + 1 ||
                  element.scrollHeight > element.clientHeight + 1,
              )
              .map((element) => ({
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
              })),
            undersized: mobile
              ? rectangles.filter((rectangle) => rectangle.width < 48 || rectangle.height < 48)
                  .length
              : 0,
            outsideViewport: rectangles.filter(
              (rectangle) =>
                rectangle.left < 0 ||
                rectangle.right > window.innerWidth ||
                rectangle.top < 0 ||
                rectangle.bottom > window.innerHeight,
            ).length,
            overlap,
          }
        },
        { mobile: testInfo.project.name === 'mobile-chromium' },
      )
      expect(result).toEqual({
        names: bookmarkNames,
        hrefs: expectedHrefs,
        documentWidth: true,
        documentHeight: true,
        bookmarkOverflow: [],
        undersized: 0,
        outsideViewport: 0,
        overlap: false,
      })
    }
  }

  if (testInfo.project.name === 'mobile-chromium') {
    const link = page.getByRole('link', { name: 'GitHub', exact: true })
    const before = await page.evaluate(() => ({
      documentTop: document.documentElement.scrollTop,
      regions: [...document.querySelectorAll<HTMLElement>('.bookmark-scroll')].map(
        (element) => element.scrollTop,
      ),
    }))
    await page.keyboard.press('Tab')
    await link.focus()
    await expect(link).toHaveCSS('outline-width', '2px')
    await expect(link).toHaveCSS('outline-offset', '3px')
    const focus = await link.evaluate((element) => {
      const rectangle = element.getBoundingClientRect()
      const boundary = element.closest<HTMLElement>('.bookmark-scroll')!.getBoundingClientRect()
      return {
        left: rectangle.left - boundary.left,
        right: boundary.right - rectangle.right,
        top: rectangle.top - boundary.top,
        bottom: boundary.bottom - rectangle.bottom,
      }
    })
    expect(Math.min(focus.left, focus.right, focus.top, focus.bottom)).toBeGreaterThanOrEqual(5)
    expect(
      await page.evaluate(() => ({
        documentTop: document.documentElement.scrollTop,
        regions: [...document.querySelectorAll<HTMLElement>('.bookmark-scroll')].map(
          (element) => element.scrollTop,
        ),
      })),
    ).toEqual(before)
  }

  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('https://external-icons.invalid/')) {
      externalRequests.push(request.url())
    }
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const image = new Image()
        image.onload = () => resolve()
        image.onerror = () => resolve()
        image.src = 'https://external-icons.invalid/favicon.ico'
        document.body.append(image)
      }),
  )
  expect(externalRequests).toEqual([])
})

test('an oversized bookmark payload scrolls only inside its own short mobile region', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Exceptional mobile overflow coverage')
  await page.setViewportSize({ width: 360, height: 650 })
  await page.route('**/api/bookmarks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        bookmarkSnapshot(
          Array.from({ length: 12 }, (_, index) => ({
            id: index.toString(16).padStart(16, '0'),
            group: ['Daily', 'Projects', 'Birding'][index % 3]!,
            name: `Destination ${index + 1}`,
            url: `https://destination-${index + 1}.example/path`,
            order: index,
          })),
        ),
      ),
    })
  })
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Destination 1', exact: true })).toBeVisible()
  const overflow = await page.evaluate(() => {
    const bookmarkRegion = document.querySelector<HTMLElement>('.bookmark-scroll')!
    return {
      documentWidth: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      documentHeight:
        document.documentElement.scrollHeight <= document.documentElement.clientHeight,
      bodyTop: document.documentElement.scrollTop,
      regionVertical: bookmarkRegion.scrollHeight > bookmarkRegion.clientHeight,
      regionHorizontal: bookmarkRegion.scrollWidth > bookmarkRegion.clientWidth + 1,
    }
  })
  expect(overflow).toEqual({
    documentWidth: true,
    documentHeight: true,
    bodyTop: 0,
    regionVertical: true,
    regionHorizontal: false,
  })
  await page.getByRole('link', { name: 'Destination 12', exact: true }).focus()
  await expect(page.getByRole('link', { name: 'Destination 12', exact: true })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0)
})

test('moon phase is shared across the release viewport, mode, and appearance matrix without new requests', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2024-04-19T12:00:00.000Z'))
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  const apiRequests: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (
      path.startsWith('/api/') &&
      !path.endsWith('/favicon') &&
      path !== '/api/bookmarks/document'
    ) {
      apiRequests.push(path)
    }
  })

  await page.goto('/')
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()

  const assertPhaseAndFit = async (mode: 'dawn' | 'dense') => {
    await expect(page.getByText('Waxing gibbous', { exact: true })).toBeVisible()
    const phaseSelector = mode === 'dawn' ? '.moon-phase-prefix' : '.dense-phase'
    await expect(page.locator(mode === 'dawn' ? '.moon-phase' : '.dense-phase')).toContainText(
      mode === 'dawn' ? 'Moon·Waxing gibbous' : 'moon · Waxing gibbous',
    )
    const expectedInkSoft = await page.evaluate(() => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--ink-soft)'
      document.body.append(probe)
      const color = getComputedStyle(probe).color
      probe.remove()
      return color
    })
    await expect(page.locator(phaseSelector)).toHaveCSS('color', expectedInkSoft)
    const fit = await page.evaluate((activeMode) => {
      const parseColor = (value: string) => {
        const color = value.trim()
        if (/^#[\da-f]{6}$/i.test(color)) {
          return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16))
        }
        const channels =
          color
            .match(/[\d.]+/g)
            ?.slice(0, 3)
            .map(Number) ?? []
        return color.startsWith('color(srgb') ? channels.map((channel) => channel * 255) : channels
      }
      const luminance = (rgb: number[]) => {
        const [red, green, blue] = rgb.map((channel) => {
          const value = channel / 255
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue
      }
      const contrast = (foreground: number[], background: number[]) => {
        const light = Math.max(luminance(foreground), luminance(background))
        const dark = Math.min(luminance(foreground), luminance(background))
        return (light + 0.05) / (dark + 0.05)
      }
      const rootStyle = getComputedStyle(document.documentElement)
      const foregroundColor = getComputedStyle(
        document.querySelector<HTMLElement>(
          activeMode === 'dawn' ? '.moon-phase-prefix' : '.dense-phase',
        )!,
      ).color
      const backgroundColors = ['--ground', '--ground-deep'].map((token) =>
        rootStyle.getPropertyValue(token),
      )
      const foreground = parseColor(foregroundColor)
      const phaseContrast = backgroundColors.map((background) =>
        contrast(foreground, parseColor(background)),
      )

      return {
        documentWidth: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        documentHeight:
          document.documentElement.scrollHeight <= document.documentElement.clientHeight,
        clippedRegions: [
          ...document.querySelectorAll<HTMLElement>('.story, .utility-section, .dense-row'),
        ]
          .filter(
            (element) =>
              element.scrollWidth > element.clientWidth + 1 ||
              element.scrollHeight > element.clientHeight + 1,
          )
          .map((element) => element.className),
        phaseClipped: [...document.querySelectorAll<HTMLElement>('.moon-phase-label')].some(
          (element) =>
            element.scrollWidth > element.clientWidth + 1 ||
            element.scrollHeight > element.clientHeight + 1,
        ),
        minimumPhaseContrast: Math.min(...phaseContrast),
        phaseColors: {
          foreground: foregroundColor,
          inkSoft: rootStyle.getPropertyValue('--ink-soft'),
          backgrounds: backgroundColors,
        },
      }
    }, mode)
    const { minimumPhaseContrast, phaseColors, ...layout } = fit
    expect(minimumPhaseContrast, JSON.stringify(phaseColors)).toBeGreaterThanOrEqual(4.5)
    expect(layout).toEqual({
      documentWidth: true,
      documentHeight: true,
      clippedRegions: [],
      phaseClipped: false,
    })
  }

  const setMode = async (mode: 'dawn' | 'dense') => {
    await selectMode(page, mode === 'dawn' ? 'Dawn' : 'Dense')
    await assertPhaseAndFit(mode)
  }

  await assertPhaseAndFit('dawn')
  await setMode('dense')
  await selectAppearance(page, 'Light')
  await assertPhaseAndFit('dense')
  await setMode('dawn')
  await selectAppearance(page, 'Dark')
  await assertPhaseAndFit('dawn')
  await setMode('dense')

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await selectAppearance(page, 'System')
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark')
  await assertPhaseAndFit('dense')
  await setMode('dawn')

  expect(apiRequests.sort()).toEqual([
    '/api/bookmarks',
    '/api/ebird/summary',
    '/api/llmdash/summary',
    '/api/tide',
    '/api/weather',
  ])

  const requestCount = apiRequests.length
  await page
    .getByRole('button', {
      name: 'Refresh weather, tide, bookmarks, eBird, and llmdash data',
    })
    .click()
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()
  expect(apiRequests.slice(requestCount).sort()).toEqual([
    '/api/bookmarks',
    '/api/ebird/summary',
    '/api/llmdash/summary',
    '/api/tide',
    '/api/weather',
  ])
  await expect(page.getByText('Waxing gibbous', { exact: true })).toBeVisible()
})

test('moon phase survives first-load and unavailable weather without becoming a source state', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2024-04-23T23:49:00.000Z'))
  const weatherGate = requestGate()
  await page.addInitScript(() => localStorage.removeItem('homedash.cache.weather.v1'))
  await page.route('**/api/weather', async (route) => {
    await weatherGate.promise
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Weather is unavailable for this fixture.' }),
    })
  })

  await page.goto('/')
  await expect(page.getByText('Full moon', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('status', { name: 'Asking Open-Meteo for the latest reading…' }),
  ).toBeVisible()

  await selectMode(page, 'Dense')
  await expect(page.getByText('Full moon', { exact: true })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Reading weather…' })).toBeVisible()

  weatherGate.release()
  await expect(page.getByText('No weather.')).toBeVisible()
  await expect(page.getByText('Full moon', { exact: true })).toBeVisible()
  await expect(page.locator('.dense-phase')).not.toHaveAttribute('aria-busy')
  await expect(page.getByText(/of 5 sources/)).toBeVisible()

  await selectMode(page, 'Dawn')
  await expect(page.getByText('Weather could not be reached.')).toBeVisible()
  await expect(page.getByText('Full moon', { exact: true })).toBeVisible()
})

test('invalid device time omits lunar output while solar and weather content remain', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Date.now = () => Number.NaN
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Refresh weather/ })).toBeEnabled()

  await expect(page.locator('.moon-phase, .dense-phase')).toHaveCount(0)
  await expect(page.getByText('58°').first()).toBeVisible()
  await expect(page.getByText(/Sunrise/).first()).toBeVisible()

  await selectMode(page, 'Dense')
  await expect(page.locator('.moon-phase, .dense-phase')).toHaveCount(0)
  await expect(page.getByText('58°').first()).toBeVisible()
  await expect(page.getByText(/daylight 12h 49m/)).toBeVisible()
  await expect(page.getByText(/of 5 sources/)).toBeVisible()
})
