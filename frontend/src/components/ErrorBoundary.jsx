import { Component } from 'react'
import i18n from '../i18n'

/** Last-resort screen; offline entries live in IndexedDB so nothing is lost on reload. */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-bold text-slate-900">{i18n.t('errors.boundary_title')}</h1>
        <p className="max-w-sm text-sm text-slate-600">{i18n.t('errors.boundary_text')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          {i18n.t('errors.reload')}
        </button>
      </div>
    )
  }
}
