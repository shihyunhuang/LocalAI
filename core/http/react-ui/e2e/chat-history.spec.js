import { test, expect } from '@playwright/test'

// Helper: mock capabilities so ModelSelector auto-selects a model
async function setupChatPage(page) {
  await page.route('**/api/models/capabilities', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: 'test-model', capabilities: ['FLAG_CHAT'] }],
      }),
    })
  })
}

// Helper: mock a successful streaming chat response
async function mockChatResponse(page, replyText) {
  await page.route('**/v1/chat/completions', (route) => {
    const body = [
      `data: {"choices":[{"delta":{"content":"${replyText}"},"index":0}]}\n\n`,
      'data: [DONE]\n\n',
    ].join('')
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body,
    })
  })
}

// Helper: send a message and wait for assistant reply
async function sendMessage(page, message) {
  await page.locator('.chat-input').fill(message)
  await page.locator('.chat-send-btn').click()
}

test.describe('Chat - History Persistence', () => {
  test('chat history persists after page refresh', async ({ page }) => {
    await setupChatPage(page)
    await mockChatResponse(page, 'Hello back!')

    await page.goto('/app/chat')
    await expect(page.getByRole('button', { name: 'test-model' })).toBeVisible({ timeout: 10_000 })

    // Send a message
    await sendMessage(page, 'Hello world')
    await expect(page.locator('.chat-message').filter({ hasText: 'Hello world' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.chat-message').filter({ hasText: 'Hello back!' })).toBeVisible({ timeout: 10_000 })

    // Wait for the debounced localStorage save to complete (500ms delay in useDebouncedEffect)
    await page.waitForTimeout(800)

    // Refresh the page and wait for the app to be ready
    await page.reload()
    await expect(page.getByRole('button', { name: 'test-model' })).toBeVisible({ timeout: 10_000 })
    // Wait for localStorage to be read and chat to be rendered
    await page.waitForTimeout(500)

    // Messages should still be visible after refresh
    await expect(page.locator('.chat-message').filter({ hasText: 'Hello world' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.chat-message').filter({ hasText: 'Hello back!' })).toBeVisible({ timeout: 10_000 })
  })

  test('new chat starts with empty history', async ({ page }) => {
    await setupChatPage(page)
    await mockChatResponse(page, 'First reply')

    await page.goto('/app/chat')
    await expect(page.getByRole('button', { name: 'test-model' })).toBeVisible({ timeout: 10_000 })

    // Send a message in the first chat
    await sendMessage(page, 'First message')
    await expect(page.locator('.chat-message').filter({ hasText: 'First message' })).toBeVisible({ timeout: 10_000 })

    // Create a new chat
    await page.locator('button', { hasText: 'New Chat' }).click()

    // New chat should be empty — old messages should not be visible
    await expect(page.locator('.chat-message').filter({ hasText: 'First message' })).not.toBeVisible()
  })

  test('switching between chats restores correct history', async ({ page }) => {
    await setupChatPage(page)
    await mockChatResponse(page, 'Reply A')

    await page.goto('/app/chat')
    await expect(page.getByRole('button', { name: 'test-model' })).toBeVisible({ timeout: 10_000 })

    // Send a message in chat A
    await sendMessage(page, 'Message in chat A')
    await expect(page.locator('.chat-message').filter({ hasText: 'Message in chat A' })).toBeVisible({ timeout: 10_000 })

    // Create chat B and send a message
    await mockChatResponse(page, 'Reply B')
    await page.locator('button', { hasText: 'New Chat' }).click()
    await sendMessage(page, 'Message in chat B')
    await expect(page.locator('.chat-message').filter({ hasText: 'Message in chat B' })).toBeVisible({ timeout: 10_000 })

    // Switch back to chat A (new chats are prepended, so chat A is now second)
    await page.locator('.chat-list-item').nth(1).click()

    // Chat A's message should be restored
    await expect(page.locator('.chat-message').filter({ hasText: 'Message in chat A' })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.chat-message').filter({ hasText: 'Message in chat B' })).not.toBeVisible()
  })

  test('deleting a chat removes it from the list', async ({ page }) => {
    await setupChatPage(page)
    await mockChatResponse(page, 'Some reply')

    await page.goto('/app/chat')
    await expect(page.getByRole('button', { name: 'test-model' })).toBeVisible({ timeout: 10_000 })

    // Send a message so the chat gets a name
    await sendMessage(page, 'Message to delete')
    await expect(page.locator('.chat-message').filter({ hasText: 'Message to delete' })).toBeVisible({ timeout: 10_000 })

    // Create a second chat so deletion is allowed (can't delete the last chat)
    await page.locator('button', { hasText: 'New Chat' }).click()

    // New chat is prepended to the list, so the original chat is now second
    // Hover and click delete on the original chat (nth(1))
    await page.locator('.chat-list-item').nth(1).hover()
    await page.locator('.chat-list-item').nth(1).locator('.chat-list-item-delete').click()

    // Individual chat delete has no confirm dialog — deletion is immediate
    // The deleted chat should no longer appear in the list
    await expect(page.locator('.chat-list-item').filter({ hasText: 'Message to delete' })).not.toBeVisible({ timeout: 5_000 })
  })

  test('chat is automatically named from the first message', async ({ page }) => {
    await setupChatPage(page)
    await mockChatResponse(page, 'Got it!')

    await page.goto('/app/chat')
    await expect(page.getByRole('button', { name: 'test-model' })).toBeVisible({ timeout: 10_000 })

    const longMessage = 'This is a very long message that should be truncated to forty chars'
    await sendMessage(page, longMessage)
    await expect(page.locator('.chat-message').filter({ hasText: longMessage.slice(0, 20) })).toBeVisible({ timeout: 10_000 })

    // Chat name in the sidebar should be truncated to 40 chars + "..."
    const expectedName = longMessage.slice(0, 40) + '...'
    await expect(page.locator('.chat-list-item-name').filter({ hasText: expectedName })).toBeVisible({ timeout: 5_000 })
  })
})
