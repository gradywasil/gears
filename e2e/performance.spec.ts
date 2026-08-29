import { expect, test } from '@playwright/test'

/**
 * Performance + stability validation (T15): the dev benchmark page seeds a
 * 23-gear serpentine train at 60 RPM and reports rolling fps in document.title.
 * Headed Chromium on the dev machine is the measurement floor; the acceptance
 * bar is 20+ gears at 60 fps (threshold 50 to absorb run-to-run noise).
 */

const SAMPLE_MS = 60_000

test('23-gear train holds frame rate over a soak', async ({ page }) => {
  test.setTimeout(SAMPLE_MS + 30_000)
  await page.goto('/?benchmark')
  await page.waitForFunction(() => /^BENCH:/.test(document.title), undefined, {
    timeout: 15_000,
  })

  const readFps = () =>
    page.evaluate(() => parseFloat(document.title.replace('BENCH:', '')))

  const early = await readFps()
  expect(early).toBeGreaterThanOrEqual(50)

  // Soak: sample again a minute in — a leak or drift shows up as a collapse.
  await page.waitForTimeout(SAMPLE_MS)
  const late = await readFps()
  expect(late).toBeGreaterThanOrEqual(50)

  console.log(`benchmark fps: early=${early.toFixed(1)} late=${late.toFixed(1)}`)
})
