import { expect, test } from '@playwright/test'

/**
 * Regression (user report, HiDPI): tray chips draw into DPR-scaled buffers
 * (56 × devicePixelRatio). Without a CSS box the displayed canvas grows with
 * the buffer — 112px on a 2× display — overflowing the 60px chips. This suite
 * runs at DPR 2 to keep that pinned.
 */
test.use({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 })

test('tray chip canvases stay chip-sized on 2× displays', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => (window as unknown as { __gears?: unknown }).__gears !== undefined)

  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('.tray-chip')].map((chip) => {
      const c = chip.querySelector('canvas')!
      const chipRect = chip.getBoundingClientRect()
      const canvasRect = c.getBoundingClientRect()
      return {
        chip: chip.id || (chip.textContent ?? '').trim(),
        chipW: chipRect.width,
        chipH: chipRect.height,
        canvasW: canvasRect.width,
        canvasH: canvasRect.height,
        buffer: c.width,
      }
    }),
  )

  expect(boxes).toHaveLength(8)
  for (const b of boxes) {
    // Buffer is retina-scaled for crispness…
    expect(b.buffer).toBe(112)
    // …but the displayed box stays inside the 60px chip.
    expect(b.canvasW).toBeLessThanOrEqual(b.chipW)
    expect(b.canvasH).toBeLessThanOrEqual(b.chipH)
  }

  // And no chip's canvas may spill into its neighbor: strict vertical stack,
  // each rect confined to its own chip row.
  const rects = await page.evaluate(() =>
    [...document.querySelectorAll('.tray-chip canvas')].map((c) => {
      const r = c.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    }),
  )
  for (let i = 1; i < rects.length; i++) {
    expect(rects[i]!.y).toBeGreaterThanOrEqual(rects[i - 1]!.y + rects[i - 1]!.h - 1)
  }
})
