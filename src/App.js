import logo from './logo.png';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank" rel="noopener noreferrer">
          <img src={logo} className="App-logo" alt="logo" />
        </a>
        <div className="App-text">
          <p>Hello World!</p>
          <p>Good morning Frontend Hero!</p>
        </div>
      </header>
    </div>
  );
}

export default App;