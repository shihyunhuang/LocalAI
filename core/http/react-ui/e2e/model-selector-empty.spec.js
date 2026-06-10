import { test, expect } from './coverage-fixtures.js'

function mockEmptyCapabilities(page) {
  return page.route('**/api/models/capabilities', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    })
  })
}

const pages = [
  { path: '/app/tts', name: 'TTS' },
  { path: '/app/image', name: 'Image generation' },
]

for (const pageCase of pages) {
  test(`ModelSelector links to Models when ${pageCase.name} has no compatible model`, async ({ page }) => {
    await mockEmptyCapabilities(page)

    await page.goto(pageCase.path)

    await expect(page.getByRole('button', { name: 'No models available' })).toBeDisabled({ timeout: 10_000 })
    await expect(page.getByText('No compatible models are installed. Add one from the Models page.')).toBeVisible()

    const modelsLink = page.getByRole('link', { name: 'Browse Models' })
    await expect(modelsLink).toBeVisible()
    await expect(modelsLink).toHaveAttribute('href', /\/app\/models$/)
  })
}
