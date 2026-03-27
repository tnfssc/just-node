import { expect, test } from '@playwright/test'

declare global {
  interface Window {
    __workbenchDebug?: {
      getState?: () => {
        activeTab?: {
          transcript?: Array<{ kind: string; text: string }>
        }
      }
    }
  }
}

async function transcript(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(() => {
    const state = window.__workbenchDebug?.getState?.()
    const transcript = state?.activeTab?.transcript ?? []
    return transcript.slice(-24).map((line) => `${line.kind}:${line.text}`).join('\n')
  })
}

test('npm install makes a dependency available to the next runtime command', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })

  const input = page.locator('#xterm-input')

  await input.click()
  await input.pressSequentially('npm i typescript')
  await input.press('Enter')

  await expect.poll(() => transcript(page), { timeout: 30_000 }).toContain('stdout:installed typescript')

  await input.click()
  await input.pressSequentially(`node -e "import('typescript').then((ts) => console.log(ts.default?.version ?? ts.version))"`)
  await input.press('Enter')

  await expect.poll(() => transcript(page), { timeout: 30_000 }).toContain('stdout:6.0.2')
})
