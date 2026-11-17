import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'md-editor',
  component: 'Pane',
  requestId: 'md-editor',
  props: {
    title: 'notes.md',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const row = (tool: string, input: unknown) =>
  ({
    plugin: 'md-editor',
    component: 'ToolUse',
    requestId: 't1',
    props: {
      tool_use_id: 't1',
      tool,
      input,
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
    },
  }) as const

const SURFACES = ['terminal', 'desktop'] as const

test('/md opens the file and Enter saves it', async ($, on) => {
  const writes: { path: string; text: string }[] = []
  on('command.register', () => ({ value: { command: 'md' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: '# Hello' }))
  on('fs.write', (_, e) => {
    writes.push(e)
    return { value: undefined }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const out = await $.command.run({ command: 'md', args: 'notes.md' })
  expect(JSON.stringify(out)).toContain('Opened notes.md')

  let text = '# Hello'
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Input' }))?.props.value).toBe(text)
    text += `\n${surface}`
    await ui.input({ key: 'body', text, kind: 'submit' })
    expect(writes.at(-1)?.path.endsWith('notes.md')).toBe(true)
    expect(writes.at(-1)?.text).toBe(text)
    await ui.unmount()
  }
})

test('rows that are not markdown files are left alone', async ($, on) => {
  for (const surface of SURFACES) {
    for (const r of [row('Bash', { command: 'ls' }), row('Read', { file_path: 'a.ts' })]) {
      const ui = await $.ui.mount({ ...r, surface })
      expect(await ui.find({ type: 'Button', key: 'md-edit' })).toBeUndefined()
      await ui.unmount()
    }
  }
})

test('a markdown row gets Edit, and Edit opens the pane', async ($, on) => {
  let opened = ''
  on('ui.open', (_, e) => {
    opened = e.title ?? ''
    return { value: { isPlaced: true } }
  })
  on('fs.read', () => ({ value: 'x' }))

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...row('Read', { file_path: 'notes.md' }), surface })
    expect(await ui.find({ type: 'Button', key: 'md-edit' })).toBeDefined()
    await ui.press({ key: 'md-edit' })
    await ui.unmount()
  }
  expect(opened).toBe('notes.md')
})

test('Reload shows only when Claude changes the open file', async ($, on) => {
  let disk = 'v1'
  on('command.register', () => ({ value: { command: 'md' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ value: disk }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'md', args: 'notes.md' })

  const edit = (file_path: string) =>
    $.tool.call({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b' })

  await edit(String.raw`C:\work\other.md`)
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Button', key: 'reload' })).toBeUndefined()
  await ui.unmount()

  disk = 'v2'
  await edit(String.raw`C:\work\notes.md`)
  for (const surface of SURFACES) {
    ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Button', key: 'reload' })).toBeDefined()
      await ui.press({ key: 'reload' })
    }
    expect((await ui.find({ type: 'Input' }))?.props.value).toBe('v2')
    expect(await ui.find({ type: 'Button', key: 'reload' })).toBeUndefined()
    await ui.unmount()
  }
})
