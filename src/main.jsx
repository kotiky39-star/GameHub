import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Route, Switch } from 'wouter';
import './index.css';
import App from './App.jsx';
import HubPage from './pages/HubPage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Switch>
      <Route path="/hub" component={HubPage} />
      <Route component={App} />
    </Switch>
  </StrictMode>,
);