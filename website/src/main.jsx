import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const features = [
  {
    icon: '🗺️',
    title: 'One local Map server',
    text: 'Run CatsMap on one computer and let everyone on the same Wi-Fi join from a browser.',
  },
  {
    icon: '💬',
    title: 'Discord-style chat',
    text: 'Channels, member presence, markdown messages, search, reactions, uploads, and custom emoji keep teams moving.',
  },
  {
    icon: '🔐',
    title: 'Private by default',
    text: 'CatsMap is self-hosted for LAN-first conversations instead of sending every message to a third-party service.',
  },
  {
    icon: '🌉',
    title: 'Share-code bridges',
    text: 'Admins can exchange share codes to bridge two trusted networks when a group needs to chat across locations.',
  },
]

const setupSteps = [
  ['Install requirements', 'Install Rust for the server and Node.js for the React web client.'],
  ['Start CatsMap', 'Run ./stuff/start.sh, or run the Rust server from stuff/server and the web app from stuff/web during development.'],
  ['Open the map', 'Visit http://localhost:3000 on the host, then connect other devices on the same Wi-Fi to the host address.'],
  ['Create accounts', 'Sign in with your CatsMap account, join the default channels, and invite your group.'],
]

const deploySteps = [
  'Edit website/package.json and replace YOUR_GITHUB_USERNAME in the homepage field.',
  'Push the repository to GitHub.',
  'In GitHub, open Settings → Pages and choose GitHub Actions as the source.',
  'The included workflow builds the website folder and publishes it to GitHub Pages on every push to main.',
]

function ChatScreenshot() {
  return (
    <div className="screenshot browser" aria-label="CatsMap chat screenshot mockup">
      <div className="browserBar"><span /><span /><span /><p>catsmap.local</p></div>
      <div className="chatMock">
        <aside>
          <strong>🐱 CatsMap</strong>
          <button># general</button>
          <button># plans</button>
          <button># cat-pics</button>
          <div className="shareCode">Share code<br /><b>MEOW-7K2</b></div>
        </aside>
        <main>
          <header><b># general</b><span>7 cats online</span></header>
          <div className="message"><b>Mochi</b><p>Server is up. Everyone can join from the same Wi-Fi!</p></div>
          <div className="message mine"><b>Luna</b><p>Markdown, files, search, and custom emoji are ready. 🐾</p></div>
          <div className="composer">Message #general…</div>
        </main>
      </div>
    </div>
  )
}

function LoginScreenshot() {
  return (
    <div className="screenshot loginShot" aria-label="CatsMap login screenshot mockup">
      <div className="catLogo" aria-hidden="true">🐱</div>
      <h3>CatsMap</h3>
      <p>Sign in to your private LAN chat 🗺️</p>
      <label>Username</label>
      <div className="input">your-cat-name</div>
      <label>Password</label>
      <div className="input dots">••••••••</div>
      <button>🐱 Enter the Map</button>
    </div>
  )
}

function App() {
  return (
    <>
      <nav className="nav">
        <a className="brand" href="#top"><span className="brandMark" aria-hidden="true">🐱</span>CatsMap</a>
        <div>
          <a href="#features">Features</a>
          <a href="#screenshots">Screenshots</a>
          <a href="#setup">Setup</a>
          <a href="#deploy">Deploy</a>
        </div>
      </nav>

      <header id="top" className="hero">
        <section className="heroCopy">
          <p className="eyebrow">Cute, private LAN chat</p>
          <h1>Like Discord, but it lives on your own map.</h1>
          <p className="lede">CatsMap helps homes, classrooms, labs, clubs, and small events run a friendly local chat server from one computer on the network.</p>
          <div className="actions">
            <a className="primary" href="#setup">Set it up</a>
            <a className="secondary" href="#screenshots">View screenshots</a>
          </div>
        </section>
        <ChatScreenshot />
      </header>

      <section id="features" className="section">
        <p className="eyebrow">Features</p>
        <h2>Everything your local group needs to talk.</h2>
        <div className="featureGrid">
          {features.map(feature => (
            <article className="card" key={feature.title}>
              <span>{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="screenshots" className="section split">
        <div>
          <p className="eyebrow">Screenshots</p>
          <h2>A glassy interface for joining and chatting.</h2>
          <p>CatsMap opens with a simple login screen, then drops users into a channel-based workspace with online members, messages, and admin controls.</p>
        </div>
        <div className="shotGrid">
          <LoginScreenshot />
          <ChatScreenshot />
        </div>
      </section>

      <section id="setup" className="section">
        <p className="eyebrow">How to use it</p>
        <h2>Start a map in minutes.</h2>
        <div className="steps">
          {setupSteps.map(([title, text], index) => (
            <article className="step" key={title}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="deploy" className="section deploy">
        <p className="eyebrow">GitHub Pages</p>
        <h2>Deploy this marketing site.</h2>
        <ol>
          {deploySteps.map(step => <li key={step}>{step}</li>)}
        </ol>
        <pre><code>cd website\nnpm install\nnpm run build</code></pre>
      </section>

      <footer>Made for CatsMap crews. 🐾</footer>
    </>
  )
}

createRoot(document.getElementById('root')).render(<App />)
