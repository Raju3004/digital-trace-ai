import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Shell } from './components/layout/Shell';
import { ErrorState } from './components/ui';

import Dashboard from './pages/Dashboard';
import NewInvestigation from './pages/NewInvestigation';
import Processing from './pages/Processing';
import Investigations from './pages/Investigations';
import Identity from './pages/Identity';
import Candidates from './pages/Candidates';
import Correlation from './pages/Correlation';
import DigitalFootprint from './pages/DigitalFootprint';
import Evidence from './pages/Evidence';
import Conflicts from './pages/Conflicts';
import RelationshipGraph from './pages/RelationshipGraph';
import Timeline from './pages/Timeline';
import Report from './pages/Report';
import NotFound from './pages/NotFound';

/** One failing panel must never take the whole platform down. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DII] Render error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8">
          <ErrorState
            title="This view failed to render"
            message={this.state.error.message}
            retry={() => this.setState({ error: null })}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Shell>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewInvestigation />} />
            <Route path="/processing/:id" element={<Processing />} />
            <Route path="/investigations" element={<Investigations />} />
            <Route path="/identity" element={<Identity />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/correlation" element={<Correlation />} />
            <Route path="/footprint" element={<DigitalFootprint />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/conflicts" element={<Conflicts />} />
            <Route path="/graph" element={<RelationshipGraph />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/report" element={<Report />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </Shell>
    </AppProvider>
  );
}
