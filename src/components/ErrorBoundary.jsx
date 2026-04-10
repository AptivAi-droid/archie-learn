import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 bg-navy rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-gold text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-navy text-center mb-3">Something went wrong</h1>
          <p className="text-gray-500 text-center max-w-xs mb-8">
            Archie ran into an unexpected problem. Refresh the page to try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full max-w-sm h-14 bg-navy text-white text-lg font-semibold rounded-xl active:opacity-90 transition-opacity"
          >
            Refresh page
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-6 text-xs text-red-500 max-w-sm overflow-auto text-left bg-red-50 p-3 rounded-lg">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
