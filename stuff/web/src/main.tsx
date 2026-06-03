import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// StrictMode disabled: it double-invokes effects in dev, causing
// the WebSocket to connect, immediately close, and fire the server-side
// disconnect handler — making users appear to join then instantly leave.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
