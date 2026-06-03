import { ReactNode } from 'react'

function highlightCode(code: string, lang?: string): ReactNode {
  const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'from', 'export', 'async', 'await', 'def', 'fn', 'pub', 'impl', 'struct', 'enum']
  if (!lang) {
    return <code style={{ fontFamily: 'monospace', fontSize: '13px' }}>{code}</code>
  }
  const parts = code.split(/(\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|def|fn|pub|impl|struct|enum)\b|"[^"]*"|'[^']*'|\d+)/g)
  return (
    <code style={{ fontFamily: 'monospace', fontSize: '13px', display: 'block', whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) => {
        if (keywords.includes(part)) {
          return <span key={i} style={{ color: '#c084fc' }}>{part}</span>
        }
        if (/^["']/.test(part)) {
          return <span key={i} style={{ color: '#86efac' }}>{part}</span>
        }
        if (/^\d+$/.test(part)) {
          return <span key={i} style={{ color: '#fbbf24' }}>{part}</span>
        }
        return <span key={i}>{part}</span>
      })}
    </code>
  )
}

export function MarkdownContent({ text, onMentionClick }: { text: string; onMentionClick?: (name: string) => void }) {
  const blocks: ReactNode[] = []
  const lines = text.split('\n')
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push(
        <pre key={key++} style={{
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '10px 12px',
          margin: '6px 0',
          overflow: 'auto',
        }}>
          {lang && (
            <div style={{ fontSize: '10px', color: 'rgba(240,230,255,0.4)', marginBottom: '6px', fontWeight: 700 }}>
              {lang}
            </div>
          )}
          {highlightCode(codeLines.join('\n'), lang)}
        </pre>
      )
      i++
      continue
    }

    blocks.push(
      <span key={key++} style={{ display: 'block' }}>
        {parseInline(line, onMentionClick)}
      </span>
    )
    i++
  }

  return <>{blocks}</>
}

function parseInline(line: string, onMentionClick?: (name: string) => void): ReactNode[] {
  const parts: ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\)|@[\w.-]+)/g
  let last = 0
  let match: RegExpExecArray | null
  let k = 0

  while ((match = regex.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(<span key={k++}>{line.slice(last, match.index)}</span>)
    }
    const token = match[0]
    if (token.startsWith('`')) {
      parts.push(
        <code key={k++} style={{
          background: 'rgba(255,255,255,0.08)',
          padding: '1px 5px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '13px',
        }}>
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      parts.push(<strong key={k++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      parts.push(<em key={k++}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('[')) {
      parts.push(
        <a key={k++} href={match[3]} target="_blank" rel="noopener noreferrer"
          style={{ color: '#a78bfa', textDecoration: 'underline' }}>
          {match[2]}
        </a>
      )
    } else if (token.startsWith('@')) {
      const name = token.slice(1)
      parts.push(
        <span key={k++}
          onClick={() => onMentionClick?.(name)}
          style={{
            color: '#c084fc',
            fontWeight: 700,
            cursor: onMentionClick ? 'pointer' : 'default',
            background: 'rgba(168,85,247,0.15)',
            padding: '0 4px',
            borderRadius: '4px',
          }}
        >
          {token}
        </span>
      )
    }
    last = match.index + token.length
  }

  if (last < line.length) {
    parts.push(<span key={k++}>{line.slice(last)}</span>)
  }

  return parts.length ? parts : [line]
}
