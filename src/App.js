import React from 'react';
import './Styles.css';
import Header from './components/Header';
import QuoteForm from './components/QuoteForm';
import Dashboard from './components/Dashboard';
import IframeResizer from './components/IframeResizer';

function App() {
  const handleReset = () => {
    // TODO: Implement reset logic
    window.location.reload();
  };

  // Lift up a ref to Dashboard's handleAnyInputChange
  const [dashboardInputChange, setDashboardInputChange] = React.useState(() => () => {});
  const quoteFormRef = React.useRef();

  return (
    <IframeResizer>
      <div className="container">
        <Header onReset={handleReset} />
        <QuoteForm onAnyInputChange={dashboardInputChange} ref={quoteFormRef} />
        <hr />
        <Dashboard setInputChangeHandler={setDashboardInputChange} quoteFormRef={quoteFormRef} />
      </div>
    </IframeResizer>
  );
}

export default App; 