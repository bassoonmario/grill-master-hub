import { useMemo, useState, type CSSProperties } from 'react'

const URL_REGEX = /https?:\/\/[^\s<>"']+/g
const MAPS_REGEX = /(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i

type TextSegment = { type: 'text' | 'link'; value: string }

function splitTextWithLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let lastIndex = 0
  const regex = new RegExp(URL_REGEX)
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    segments.push({ type: 'link', value: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) segments.push({ type: 'text', value: text.slice(lastIndex) })
  return segments
}

export function TaskLinkPreview({ text, className, style }: {
  text?: string | null
  className?: string
  style?: CSSProperties
}) {
  const segments = useMemo(() => splitTextWithLinks(text || ''), [text])
  const mapsLinks = useMemo(
    () => segments.filter(s => s.type === 'link' && MAPS_REGEX.test(s.value)).map(s => s.value),
    [segments]
  )

  if (!text) return null

  return (
    <span className={className} style={style}>
      {segments.map((seg, i) => seg.type === 'link' ? (
        <a
          key={i}
          href={seg.value}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--orange)', textDecoration: 'underline', wordBreak: 'break-all' }}
        >
          {seg.value}
        </a>
      ) : (
        <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{seg.value}</span>
      ))}
      {mapsLinks.map((url, i) => <MapEmbed key={i} url={url} />)}
    </span>
  )
}

function MapEmbed({ url }: { url: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  let src: string
  try {
    src = `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`
  } catch {
    return null
  }

  return (
    <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <iframe
        src={src}
        width="100%"
        height="180"
        style={{ border: 0, display: 'block' }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
