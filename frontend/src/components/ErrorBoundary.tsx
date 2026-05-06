import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Неизвестная ошибка',
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: '#5d6b3a' }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Что-то пошло не так</p>
          <p style={{ fontSize: 14, color: '#888', marginTop: 8 }}>{this.state.message}</p>
          <button
            style={{
              marginTop: 16,
              padding: '8px 24px',
              background: '#5d6b3a',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            Перезагрузить
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
