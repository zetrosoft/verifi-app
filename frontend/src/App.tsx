import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import ClientDashboard from "./views/ClientDashboard";
import FreelancerDashboard from "./views/FreelancerDashboard";
import RoleSelectionPage from "./views/RoleSelectionPage";
import { ThemeProvider } from "./components/theme-provider";

import JobsWithBids from "./components/client/JobsWithBids";
import ViewBidsPage from "./components/client/ViewBids";

const App: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Router>
        <div className="flex flex-col min-h-screen bg-background text-foreground">
          {/* Main Content / Routes */}
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<RoleSelectionPage />} />
              <Route path="/client-dashboard" element={<ClientDashboard />} />
              <Route path="/freelancer-dashboard" element={<FreelancerDashboard />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;