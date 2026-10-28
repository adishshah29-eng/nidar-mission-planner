import { Component, useId, useState } from 'react'
import { validateNumber } from '../lib/config'

export function Panel({ title, icon: Icon, actions, children, className = '', level = 2 }) {
  const id = useId()
  const H = `h${level}`
  return (
    <section className={`panel ${className}`} aria-labelledby={id}>
      <header className="panel-head">
        {Icon && <Icon aria-hidden="true" size={18} />}
        <H id={id}>{title}</H>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function Dot({ tone = 'idle' }) {
  return <span className={`dot dot-${tone}`} aria-hidden="true" />
}

// Number input that validates as you type but only saves on blur, so a half-typed value never persists.
export function NumberField({ label, value, min, max, onCommit, onDraftError, className = '' }) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  const [seen, setSeen] = useState(value)
  const [error, setError] = useState(null)
  if (value !== seen) {
    setSeen(value)
    setDraft(String(value))
    setError(null)
  }
  const field = { label, min, max }
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => {
          setDraft(e.target.value)
          const err = validateNumber(field, e.target.value)
          setError(err)
          onDraftError?.(err)
        }}
        onBlur={() => {
          if (!error && Number(draft) !== value) onCommit(Number(draft))
        }}
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}

export function SelectField({ label, value, options, onChange }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

export function CheckField({ label, checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

// Quadcopter mark drawn to match the lucide stroke style.
export function QuadIcon({ size = 24, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...rest}>
      <path d="M9 9 6.5 6.5M15 9l2.5-2.5M9 15l-2.5 2.5M15 15l2.5 2.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
      <circle cx="5" cy="5" r="3" />
      <circle cx="19" cy="5" r="3" />
      <circle cx="5" cy="19" r="3" />
      <circle cx="19" cy="19" r="3" />
    </svg>
  )
}

// Last line of defence: if any screen throws, offer a way out instead of a blank page.
export class AppErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  resetData = () => {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('nidar.')).forEach((k) => localStorage.removeItem(k))
    } catch {
      // Storage blocked: reloading is still the best we can do.
    }
    window.location.reload()
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>Saved data in this browser may be damaged. Resetting clears missions, plans and settings saved here.</p>
        <button type="button" className="btn btn-primary" onClick={this.resetData}>Reset saved data</button>
      </div>
    )
  }
}
