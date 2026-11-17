# md-editor

A Claude Code mod that opens a markdown file in a pane beside the chat, so you can edit it and save it.

- `/md <file.md>` opens the file in the editor pane. A file that does not exist is created when you save.
- Press Enter or click **Save** to write the file.
- When Claude reads, writes or edits a `.md` file, an **Edit** button shows under that row in the chat. Click it to open the file in the pane.
- When Claude changes the open file, a **Reload updated file** button shows next to Save. Click it to load Claude's version.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install md-editor --marketplace jcyr13/md-editor
```

Answer `y` to add the marketplace, then pick a scope (user scope is first; press Enter).

From a shell:

```
claude plugin install md-editor --marketplace jcyr13/md-editor
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `jcyr13/md-editor`, then Add plugin.

## Limits

- The pane shows plain markdown text, not formatted text.
- Only Claude's Edit and Write tools mark the file as changed. Changes from Bash or other apps are not seen.
- Files over 4 MB cannot be opened.
