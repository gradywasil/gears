import { expect, test, type Page } from '@playwright/test'

/**
 * E2e coverage for the flows the milestone gates named (T14). Placement uses
 * manual mouse sequences with interpolated moves (R4) — never dragTo.
 * State assertions read the dev-only window.__gears hook.
 */

type GearRecord = { id: string; teeth: number; x: number; y: number }

// Hook functions must be invoked inside the page: evaluate() cannot serialize
// functions back across the wire.
const gearsOf = (page: Page) =>
  page.evaluate(() => (window as { __gears: { gears: () => GearRecord[] } }).__gears.gears())
const driveIdOf = (page: Page) =>
  page.evaluate(() => (window as { __gears: { driveId: () => string | null } }).__gears.driveId())
const runningOf = (page: Page) =>
  page.evaluate(() => (window as { __gears: { running: () => boolean } }).__gears.running())
const soundOf = (page: Page) =>
  page.evaluate(() =>
    (window as {
      __gears: { sound: () => { enabled: boolean; audioState: string; meshVoices: number } }
    }).__gears.sound(),
  )

/** Chip centers for each palette size (viewport coordinates). */
const CHIPS: Record<number, { x: number; y: number }> = {
  10: { x: 40, y: 97 },
  14: { x: 40, y: 165 },
  18: { x: 40, y: 233 },
  24: { x: 40, y: 301 },
}

async function dragChipTo(
  page: Page,
  teeth: number,
  to: { x: number; y: number },
) {
  const from = CHIPS[teeth]!
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 })
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => (window as unknown as { __gears?: unknown }).__gears !== undefined)
})

test('first gear becomes the drive and spins', async ({ page }) => {
  await dragChipTo(page, 10, { x: 500, y: 350 })
  await expect.poll(async () => (await gearsOf(page)).length).toBe(1)
  expect(await driveIdOf(page)).toBe((await gearsOf(page))[0]!.id)
  expect(await runningOf(page)).toBe(true)
  // RPM slider enabled once a drive exists.
  await expect(page.getByLabel('Drive gear speed in RPM')).toBeEnabled()
})

test('second gear snaps, meshes, and the inspector reports exact values', async ({
  page,
}) => {
  await dragChipTo(page, 10, { x: 500, y: 350 })
  await dragChipTo(page, 24, { x: 615, y: 350 })
  await expect.poll(async () => (await gearsOf(page)).length).toBe(2)

  // Snapped to exact mesh distance: 30 + 72 = 102.
  const [a, b] = await gearsOf(page)
  expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(102, 5)

  // Last placed is selected: inspector shows 12.5 RPM and ×2.4 from 30 RPM.
  const inspector = page.getByRole('complementary', { name: 'Gear inspector' })
  await expect(inspector).toBeVisible()
  await expect(inspector.getByText('12.5 RPM')).toBeVisible()
  await expect(inspector.getByText('×2.4')).toBeVisible()
})

test('overlapping drop is refused; nothing is placed', async ({ page }) => {
  await dragChipTo(page, 10, { x: 500, y: 350 })
  // Drop a 10t straight onto the existing 10t: overlap → shake, no placement.
  await dragChipTo(page, 10, { x: 500, y: 350 })
  await page.waitForTimeout(500)
  expect((await gearsOf(page)).length).toBe(1)
})

test('deleting the drive prompts for a new one; Set as drive recovers', async ({
  page,
}) => {
  await dragChipTo(page, 10, { x: 500, y: 350 })
  await dragChipTo(page, 24, { x: 615, y: 350 })
  await expect.poll(async () => (await gearsOf(page)).length).toBe(2)

  // Select and delete the drive (the 10t at 500,350).
  await page.mouse.click(500, 350)
  const inspector = page.getByRole('complementary', { name: 'Gear inspector' })
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Delete' }).click()

  await expect.poll(async () => driveIdOf(page)).toBe(null)
  await expect(page.locator('.drive-missing')).toContainText('Set as drive')

  // Recover: select the remaining 24t and make it the drive.
  await page.mouse.click(610, 350)
  await inspector.getByRole('button', { name: 'Set as drive' }).click()
  await expect.poll(async () => driveIdOf(page)).not.toBe(null)
  await expect(page.locator('.drive-missing')).toHaveCount(0)
})

test('saves round-trip: save slot, reload, design restored', async ({ page }) => {
  await dragChipTo(page, 10, { x: 500, y: 350 })
  await dragChipTo(page, 24, { x: 615, y: 350 })
  await expect.poll(async () => (await gearsOf(page)).length).toBe(2)

  await page.getByRole('button', { name: 'Saves' }).click()
  const panel = page.getByRole('region', { name: 'Saved designs' })
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: 'Save', exact: true }).first().click()
  await page.waitForTimeout(300)

  // Let the debounced autosave (500ms) land before reloading.
  await page.waitForTimeout(700)
  await page.reload()
  await page.waitForFunction(() => (window as unknown as { __gears?: unknown }).__gears !== undefined)
  await expect.poll(async () => (await gearsOf(page)).length).toBe(2)
  expect(await driveIdOf(page)).not.toBe(null)

  // Wipe the bench, then restore from the slot.
  for (const at of [
    { x: 500, y: 350 },
    { x: 610, y: 350 },
  ]) {
    await page.mouse.click(at.x, at.y)
    const inspector = page.getByRole('complementary', { name: 'Gear inspector' })
    await inspector.getByRole('button', { name: 'Delete' }).click()
  }
  await expect.poll(async () => (await gearsOf(page)).length).toBe(0)

  await page.getByRole('button', { name: 'Saves' }).click()
  await page
    .getByRole('region', { name: 'Saved designs' })
    .getByRole('button', { name: 'Restore', exact: true })
    .first()
    .click()
  await expect.poll(async () => (await gearsOf(page)).length).toBe(2)
})

test('deleting a gear is undoable from the toast', async ({ page }) => {
  await dragChipTo(page, 10, { x: 500, y: 350 })
  await expect.poll(async () => (await gearsOf(page)).length).toBe(1)

  await page.mouse.click(500, 350)
  const inspector = page.getByRole('complementary', { name: 'Gear inspector' })
  await expect(inspector).toBeVisible()
  await inspector.getByRole('button', { name: 'Delete' }).click()

  await expect.poll(async () => (await gearsOf(page)).length).toBe(0)
  const undo = page.getByRole('button', { name: 'Undo' })
  await expect(undo).toBeVisible()
  await undo.click()

  await expect.poll(async () => (await gearsOf(page)).length).toBe(1)
  expect(await driveIdOf(page)).not.toBe(null)
})

test('keyboard placement works from the tray; Esc closes the saves panel', async ({ page }) => {
  // Focus the first tray chip and press Enter — a gear lands on the bench.
  await page.getByRole('button', { name: 'Add 10-tooth gear' }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await gearsOf(page)).length).toBe(1)
  expect(await driveIdOf(page)).not.toBe(null)

  // Space toggles the machine (focus moved off the button — Space activates buttons natively).
  await page.mouse.click(200, 150)
  await page.keyboard.press('Space')
  await expect.poll(async () => runningOf(page)).toBe(false)
  await page.keyboard.press('Space')
  await expect.poll(async () => runningOf(page)).toBe(true)

  // Esc closes the saves panel.
  await page.getByRole('button', { name: 'Saves' }).click()
  await expect(page.getByRole('region', { name: 'Saved designs' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Saved designs' })).toHaveCount(0)
})

test('machine sound: voices follow meshes, mute persists', async ({ page }) => {
  // Keyboard placement is a user gesture — the AudioContext may start.
  await page.getByRole('button', { name: 'Add 10-tooth gear' }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await gearsOf(page)).length).toBe(1)
  await expect.poll(async () => (await soundOf(page)).audioState).toBe('running')
  // A single gear has no mesh: hum only.
  expect((await soundOf(page)).meshVoices).toBe(0)
  expect((await soundOf(page)).enabled).toBe(true)

  // Second gear meshes: one tick-train voice appears. Aim relative to the
  // first gear's actual (spiral-placed) position, in viewport coordinates.
  const [g0] = await gearsOf(page)
  const canvas = await page.evaluate(() => {
    const r = document.querySelector('.machine-canvas')!.getBoundingClientRect()
    return { x: r.x, y: r.y }
  })
  await dragChipTo(page, 24, { x: canvas.x + g0!.x + 110, y: canvas.y + g0!.y })
  await expect.poll(async () => (await gearsOf(page)).length).toBe(2)
  await expect.poll(async () => (await soundOf(page)).meshVoices).toBe(1)

  // Mute toggles and persists across reload.
  await page.getByRole('button', { name: 'Mute machine sound' }).click()
  await expect.poll(async () => (await soundOf(page)).enabled).toBe(false)
  await page.reload()
  await page.waitForFunction(() => (window as unknown as { __gears?: unknown }).__gears !== undefined)
  await expect.poll(async () => (await soundOf(page)).enabled).toBe(false)
  await page.getByRole('button', { name: 'Unmute machine sound' }).click()
  await expect.poll(async () => (await soundOf(page)).enabled).toBe(true)
})

test('reduced motion loads the machine paused with a visible run control', async ({
  browser,
}) => {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    window.localStorage.setItem('gears.autosave', JSON.stringify({
      v: 1,
      savedAt: Date.now(),
      gears: [{ id: 'g1', teeth: 24, x: 400, y: 350 }],
      driveId: 'g1',
      rpm: 30,
    }))
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForFunction(() => (window as unknown as { __gears?: unknown }).__gears !== undefined)
  await expect.poll(async () => runningOf(page)).toBe(false)
  const run = page.getByRole('button', { name: 'Run machine' })
  await expect(run).toBeVisible()
  await run.click()
  await expect.poll(async () => runningOf(page)).toBe(true)
  await context.close()
})
