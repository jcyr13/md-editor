import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const PANE = 'md-editor'
const path = atom({ plugin: 'md-editor', key: 'path' } as const, '')
const draft = atom({ plugin: 'md-editor', key: 'draft' } as const, '')
const saved = atom({ plugin: 'md-editor', key: 'saved' } as const, '')
const status = atom({ plugin: 'md-editor', key: 'status' } as const, '')
const changed = atom({ plugin: 'md-editor', key: 'changed' } as const, false)

// Claude's tools send absolute paths; /md may get a relative one.
const samePath = (a: string, b: string) => {
  const x = a.replaceAll('\\', '/').toLowerCase()
  const y = b.replaceAll('\\', '/').toLowerCase()
  return x === y || x.endsWith(`/${y}`) || y.endsWith(`/${x}`)
}

const openFile = async ($: EngineInterface, file: string, opened = 'Opened.') => {
  let text = ''
  let note = opened
  try {
    text = await $.fs.read(file)
  } catch {
    note = 'New file. Save to create it.'
  }
  await update($, path, () => file)
  await update($, draft, () => text)
  await update($, saved, () => text)
  await update($, status, () => note)
  await update($, changed, () => false)
  await $.ui.open({ id: PANE, title: file, focus: true })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'md',
      description: 'Open a markdown file in an editor pane: /md <file>',
    })

    return next(e)
  })

  on('command.run', { command: 'md' }, async ($, e) => {
    const file = e.args.trim()
    if (!file) {
      return { text: 'Usage: /md <file.md>' }
    }

    await openFile($, file)

    return { text: `Opened ${file} in the editor pane.` }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.tool !== 'Write' && e.tool !== 'Edit') {
      return ran
    }
    const file = await read($, path)
    if (file && ran.deny === undefined && !ran.isError && samePath(file, e.file_path)) {
      await update($, changed, () => true)
    }

    return ran
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const row = await next(e)
    const { tool, input, isRunning, isErrored } = e.props
    const file = (input as { file_path?: unknown } | null)?.file_path
    const isMd =
      ['Read', 'Write', 'Edit'].includes(tool) &&
      typeof file === 'string' &&
      /\.(md|markdown)$/i.test(file)
    if (!isMd || isRunning || isErrored) {
      return row
    }

    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {row}
        <Button key="md-edit" label="Edit" onPress={() => openFile($, file)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Input, Button } = $.ui.resolve(e)
    const file = await read($, path)
    const text = await read($, draft)
    const isDirty = text !== (await read($, saved))
    const note = await read($, status)
    const isChanged = await read($, changed)
    const rows = Math.max(3, (e.viewport?.rows ?? 24) - 4)

    if (!file) {
      return <Text dimColor>No file open. Type /md &lt;file.md&gt;.</Text>
    }

    const save = async (value: string) => {
      try {
        await $.fs.write(file, value)
        await update($, draft, () => value)
        await update($, saved, () => value)
        await update($, status, () => 'Saved.')
        await update($, changed, () => false)
      } catch (err) {
        await update($, status, () => `Save failed: ${String(err)}`)
      }
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Button key="save" label="Save" variant={isChanged ? 'secondary' : 'primary'} onPress={() => save(text)} />
          {isChanged && (
            <Button key="reload" label="Reload updated file" variant="primary" onPress={() => openFile($, file, 'Reloaded.')} />
          )}
          <Text dimColor>
            {' '}
            {isChanged ? 'Claude changed this file.' : isDirty ? 'Unsaved changes' : note}
          </Text>
        </Box>
        <Input
          key="body"
          value={text}
          rows={rows}
          submitLabel="save"
          autoFocus
          onInput={value => update($, draft, () => value)}
          onSubmit={value => save(value)}
        />
      </Box>
    )
  })
}
