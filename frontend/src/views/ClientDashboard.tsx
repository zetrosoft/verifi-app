import React from "react";
import { Container, Typography, Stack } from "@mui/material";
import CreateJobForm from "../components/CreateJobForm";
import JobList from "../components/JobList";

/**
 * @component ClientDashboard
 * @description Halaman dashboard untuk pengguna dengan peran 'Client' menggunakan Material-UI.
 * Menampilkan formulir untuk membuat pekerjaan baru dan daftar semua pekerjaan.
 */
const ClientDashboard: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ mt: 4 }}>
      <Stack spacing={4} sx={{ alignItems: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard Klien
        </Typography>
        <CreateJobForm />
        <JobList />
      </Stack>
    </Container>
  );
};

export default ClientDashboard;
