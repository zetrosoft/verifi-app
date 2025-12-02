import React, { useState, useCallback } from "react";
import { Container, Typography, Stack, Button } from "@mui/material"; // Added Button for navigation
import JobPostingForm from "../components/client/JobPostingForm"; // New component
import MyPostedJobs from "../components/client/MyPostedJobs"; // New component
import ViewBids from "../components/client/ViewBids"; // New component

/**
 * @component ClientDashboard
 * @description Client Dashboard page. Allows clients to post new jobs, view their posted jobs,
 * and manage bids for open jobs.
 */
const ClientDashboard: React.FC = () => {
  const [view, setView] = useState<'postJob' | 'myJobs' | 'viewBids'>('myJobs');
  const [selectedJobIdForBids, setSelectedJobIdForBids] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // State to trigger job list refresh

  const handleJobPosted = useCallback(() => {
    setRefreshTrigger(prev => prev + 1); // Increment to trigger refetch in MyPostedJobs
    setView('myJobs'); // Go back to my jobs after posting
  }, []);

  const handleViewBids = useCallback((jobId: number) => {
    setSelectedJobIdForBids(jobId);
    setView('viewBids');
  }, []);

  const handleBidAccepted = useCallback(() => {
    setRefreshTrigger(prev => prev + 1); // Refresh jobs after a bid is accepted
    // No need to change view, as ViewBids will call onBack
  }, []);

  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Stack spacing={4} sx={{ alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Client Dashboard
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
          <Button
            variant={view === 'myJobs' ? 'contained' : 'outlined'}
            onClick={() => { setView('myJobs'); setSelectedJobIdForBids(null); }}
          >
            My Posted Jobs
          </Button>
          <Button
            variant={view === 'postJob' ? 'contained' : 'outlined'}
            onClick={() => { setView('postJob'); setSelectedJobIdForBids(null); }}
          >
            Post New Job
          </Button>
        </Stack>

        {view === 'postJob' && (
          <JobPostingForm onJobPosted={handleJobPosted} />
        )}

        {view === 'myJobs' && (
          <MyPostedJobs onViewBids={handleViewBids} refreshTrigger={refreshTrigger} />
        )}

        {view === 'viewBids' && selectedJobIdForBids !== null && (
          <ViewBids
            jobId={selectedJobIdForBids}
            onBack={() => setView('myJobs')}
            onBidAccepted={handleBidAccepted}
          />
        )}
      </Stack>
    </Container>
  );
};

export default ClientDashboard;
