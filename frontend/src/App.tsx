import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link as RouterLink,
} from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useWeb3 } from "./contexts/Web3Context";
import ClientDashboard from "./views/ClientDashboard";
import FreelancerDashboard from "./views/FreelancerDashboard";

/**
 * @component App
 * @description Komponen utama aplikasi yang menangani routing dan tata letak dasar menggunakan Material-UI.
 * Menyertakan header navigasi dengan tombol koneksi/diskoneksi dompet dan link ke dashboard.
 */
const App: React.FC = () => {
  const { account, isConnected, connectWallet, disconnectWallet, isLoading } =
    useWeb3();

  return (
    <Router>
      <Box sx={{ flexGrow: 1 }}>
        {/* Header Navigasi menggunakan AppBar dari MUI */}
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              <RouterLink to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                AI Escrow Marketplace
              </RouterLink>
            </Typography>
            <Button component={RouterLink} to="/client" color="inherit">
              Klien
            </Button>
            <Button component={RouterLink} to="/freelancer" color="inherit">
              Freelancer
            </Button>
            {isConnected && account ? (
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
                <Typography sx={{ mr: 2 }}>
                  {account.substring(0, 6)}...{account.substring(account.length - 4)}
                </Typography>
                <Button onClick={disconnectWallet} color="secondary" variant="contained" disabled={isLoading}>
                  Disconnect
                </Button>
              </Box>
            ) : (
              <Button onClick={connectWallet} color="secondary" variant="contained" disabled={isLoading} sx={{ ml: 2 }}>
                Connect Wallet
              </Button>
            )}
          </Toolbar>
        </AppBar>

        {/* Konten Utama / Rute */}
        <Box
          component="main"
          sx={{
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center', // Center horizontally
            justifyContent: 'flex-start', // Align to start vertically, can be 'center' if desired
            minHeight: 'calc(100vh - 64px)', // Adjust based on AppBar height
            width: '100%' // Ensure Box takes full width
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/client" element={<ClientDashboard />} />
            <Route path="/freelancer" element={<FreelancerDashboard />} />
            {/* Tambahkan rute lain di sini */}
          </Routes>
        </Box>
      </Box>
    </Router>
  );
};

/**
 * @component Home
 * @description Halaman beranda sederhana untuk aplikasi menggunakan Material-UI.
 */
const Home: React.FC = () => {
  const { isConnected } = useWeb3();
  return (
    <Container maxWidth="md" sx={{ mt: 4, textAlign: 'center' }}>
      <Stack spacing={2}>
        <Typography variant="h3" component="h2" gutterBottom>
          Selamat Datang di AI Escrow Marketplace
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Platform yang aman untuk kolaborasi antara klien dan freelancer, dengan verifikasi pekerjaan otomatis oleh AI.
        </Typography>
        {!isConnected && (
          <Typography color="text.secondary">
            Harap hubungkan dompet Ethereum Anda untuk memulai!
          </Typography>
        )}
        <Typography>
          Pilih peran Anda di navigasi atas:{" "}
          <Button component={RouterLink} to="/client" variant="outlined" size="small">
            Klien
          </Button>{" "}
          atau{" "}
          <Button component={RouterLink} to="/freelancer" variant="outlined" size="small">
            Freelancer
          </Button>.
        </Typography>
      </Stack>
    </Container>
  );
};

export default App;