import { expect, test } from '@playwright/test'

const now = new Date().toISOString()
const meta = {
  generatedAt: now,
  sourceUpdatedAt: now,
  freshness: 'fresh',
  staleAfterMs: 60_000,
  issues: [],
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
                speciesCode: 'ruff',
                commonName: 'Ruff',
                observedAt: now,
                locality: 'Bay shore',
                distanceKm: 18,
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
            { id: 'github', group: 'Daily', name: 'GitHub', url: 'https://github.com', order: 0 },
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
  await expect(page.getByText('American Redstart')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-dawn.png`),
    fullPage: true,
  })

  await page.getByRole('radio', { name: 'Use Dense display mode' }).click()
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible()
  await expect(page.getByText('American Redstart')).toBeVisible()
  await expect(page.getByText('58°').first()).toBeVisible()

  await page.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Weather' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Use Dense display mode' })).toBeChecked()

  const noDocumentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )
  expect(noDocumentOverflow).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-dense.png`),
    fullPage: true,
  })
})
