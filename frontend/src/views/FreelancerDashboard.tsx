import React from "react";
import { Container, Typography, Stack } from "@mui/material";
import JobList from "../components/JobList";

/**
 * @component FreelancerDashboard
 * @description Halaman dashboard untuk pengguna dengan peran 'Freelancer' menggunakan Material-UI.
 * Menampilkan daftar semua pekerjaan.
 */
const FreelancerDashboard: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Stack spacing={4} sx={{ alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard Freelancer
        </Typography>
        <JobList />
      </Stack>
    </Container>
  );
};

export default FreelancerDashboard;
