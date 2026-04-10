import { useState } from 'react'

export function CopyableSnippet({ code }: { code: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  return (
    <div className="copyable-snippet">
      <pre>{code}</pre>
      <button
        aria-label={copied ? 'Copied' : 'Copy'}
        className="copyable-snippet__btn"
        onClick={() => {
          void navigator.clipboard.writeText(code)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }}
        type="button"
      >
        <i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'}`}></i>
      </button>
    </div>
  )
}
