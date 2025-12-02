import React, { useState, useCallback, useEffect } from "react"; // Added useEffect
import { Container, Typography, Stack, Tabs, Tab, Box } from "@mui/material";
import JobBoard from "../components/freelancer/JobBoard"; // New
import JobDetailModal from "../components/freelancer/JobDetailModal"; // New
import MyBidsList from "../components/freelancer/MyBidsList"; // New
import JobHistory from "../components/freelancer/JobHistory"; // New

/**
 * @component FreelancerDashboard
 * @description Freelancer Dashboard page. Allows freelancers to find jobs,
 * view their bids, and see their job history.
 */
const FreelancerDashboard: React.FC = () => {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState(0);

  const handleViewJobDetails = useCallback((jobId: number) => {
    console.log('[DEBUG FreelancerDashboard] handleViewJobDetails called with jobId:', jobId);
    setSelectedJobId(jobId);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedJobId(null);
  }, []);
  
  const handleBidSubmitted = useCallback(() => {
    // Optionally, could refresh the job board or move to 'My Bids' tab
    console.log("Bid submitted successfully.");
  }, []);
  
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => { // Changed event to _event
    setCurrentTab(newValue);
  };

  useEffect(() => { // Logging moved into useEffect
    console.log('[DEBUG FreelancerDashboard] selectedJobId state:', selectedJobId);
    if (selectedJobId !== null) {
      console.log('[DEBUG FreelancerDashboard] Attempting to render JobDetailModal for jobId:', selectedJobId);
    }
  }, [selectedJobId]);

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Freelancer Dashboard
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', width: '100%' }}>
            <Tabs value={currentTab} onChange={handleTabChange} centered>
                <Tab label="Job Board" />
                <Tab label="My Bids" />
                <Tab label="My History" />
            </Tabs>
        </Box>

        <Box sx={{ width: '100%', pt: 2 }}>
            {currentTab === 0 && (
                <JobBoard onViewJobDetails={handleViewJobDetails} />
            )}
            {currentTab === 1 && (
                <MyBidsList />
            )}
            {currentTab === 2 && (
                <JobHistory />
            )}
        </Box>

        {selectedJobId !== null && (
          <JobDetailModal
            jobId={selectedJobId}
            onClose={handleCloseModal}
            onBidSubmitted={handleBidSubmitted}
          />
        )}
      </Stack>
    </Container>
  );
};

export default FreelancerDashboard;
