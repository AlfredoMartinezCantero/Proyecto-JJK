import { createRoot } from 'react-dom/client';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/rajdhani/latin-400.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import '@fontsource/noto-serif-jp/latin-500.css';
import './styles.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(<App />);
