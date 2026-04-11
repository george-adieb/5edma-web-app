import { Component } from 'react';

/**
 * Global Error Boundary — catches any unhandled render error and
 * shows a recovery screen instead of a blank white page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', direction: 'rtl',
          fontFamily: 'Cairo, sans-serif', background: '#F8F7F5',
          padding: '40px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</p>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>
            حدث خطأ غير متوقع
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px', maxWidth: '360px', lineHeight: 1.7 }}>
            حدث خطأ في تحميل هذه الصفحة. يمكنك تحديث الصفحة أو العودة للرئيسية.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{
                padding: '10px 22px', borderRadius: '8px',
                background: '#8B1A1A', color: 'white',
                border: 'none', cursor: 'pointer',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
              }}
            >
              تحديث الصفحة
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              style={{
                padding: '10px 22px', borderRadius: '8px',
                background: 'white', color: '#374151',
                border: '1.5px solid #E5E7EB', cursor: 'pointer',
                fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '13px',
              }}
            >
              العودة للرئيسية
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: '24px', padding: '12px 16px',
              background: '#FEE2E2', borderRadius: '8px',
              fontSize: '11px', color: '#991B1B',
              maxWidth: '600px', overflowX: 'auto', textAlign: 'left',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
