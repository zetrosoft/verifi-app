import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Link,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import { ethers } from "ethers";
import { useWeb3 } from "../contexts/Web3Context";

/**
 * @interface Job
 * @description Mendefinisikan struktur data untuk objek Pekerjaan yang diambil dari kontrak pintar.
 */
interface Job {
  jobId: number;
  client: string;
  freelancer: string;
  amount: ethers.BigNumber;
  workDescriptionIPFSHash: string;
  resultIPFSHash: string;
  status: number;
}

/**
 * @const JOB_STATUS_MAP
 * @description Peta untuk mengonversi nilai enum status pekerjaan menjadi string dan warna untuk MUI Chip.
 */
const JOB_STATUS_MAP: { [key: number]: { label: string; color: "primary" | "secondary" | "default" | "error" | "info" | "success" | "warning" } } = {
  0: { label: "Created", color: "primary" },
  1: { label: "Funds Deposited", color: "warning" },
  2: { label: "Work Submitted", color: "info" },
  3: { label: "Verified", color: "success" },
  4: { label: "Completed", color: "default" },
  5: { label: "Cancelled", color: "error" },
};

/**
 * @component JobList
 * @description Menampilkan daftar pekerjaan dari kontrak pintar AIEscrowMarketplace, menggunakan Material-UI.
 */
const JobList: React.FC = () => {
  const { provider, contract, account, isConnected } = useWeb3();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(true);
  const [submittingWorkId, setSubmittingWorkId] = useState<number | null>(null);
  const [submitWorkIPFSHash, setSubmitWorkIPFSHash] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [jobToVerifyId, setJobToVerifyId] = useState<number | null>(null);
  const [isApprovedAction, setIsApprovedAction] = useState<boolean>(false); // true for approve, false for reject

  const handleOpenVerifyModal = (jobId: number, isApproved: boolean) => {
    setJobToVerifyId(jobId);
    setIsApprovedAction(isApproved);
    setIsVerifyModalOpen(true);
  };

  const handleCloseVerifyModal = () => {
    setIsVerifyModalOpen(false);
    setJobToVerifyId(null);
  };

  const handleVerifyWork = async () => {
    if (jobToVerifyId === null || !contract || !isConnected) return;
    try {
      const tx = await contract.verifyWork(jobToVerifyId, isApprovedAction);
      await tx.wait();
      setNotification({ open: true, message: `Pekerjaan ID: ${jobToVerifyId} berhasil ${isApprovedAction ? "diverifikasi" : "ditolak"}!`, severity: 'success' });
      fetchJobs();
      handleCloseVerifyModal();
    } catch (error: any) {
      console.error("Error verifying/rejecting work:", error);
      setNotification({ open: true, message: error.reason || `Gagal ${isApprovedAction ? "memverifikasi" : "menolak"} hasil kerja.`, severity: 'error' });
    }
  };

  const fetchJobs = useCallback(async () => {
    if (!contract || !provider) return;

    setLoadingJobs(true);
    try {
      const fetchedJobs: Job[] = [];
      const nextJobId = await contract.nextJobId();

      for (let i = 0; i < Number(nextJobId); i++) {
        const jobData = await contract.jobs(i);
        fetchedJobs.push({
          jobId: i,
          client: jobData.client,
          freelancer: jobData.freelancer,
          amount: jobData.amount,
          workDescriptionIPFSHash: jobData.workDescriptionIPFSHash,
          resultIPFSHash: jobData.resultIPFSHash,
          status: Number(jobData.status),
        });
      }
      setJobs(fetchedJobs.reverse()); // Tampilkan pekerjaan terbaru di atas
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      setNotification({ open: true, message: "Gagal mengambil daftar pekerjaan.", severity: 'error' });
    } finally {
      setLoadingJobs(false);
    }
  }, [contract, provider]);

  const handleDeposit = async (jobId: number, amount: ethers.BigNumber) => {
    if (!contract || !isConnected) {
      setNotification({ open: true, message: "Harap hubungkan dompet Anda.", severity: 'error' });
      return;
    }
    try {
      const tx = await contract.depositFunds(jobId, { value: amount });
      await tx.wait();
      setNotification({ open: true, message: `Dana untuk Pekerjaan ID: ${jobId} berhasil disetor!`, severity: 'success' });
      fetchJobs();
    } catch (error: any) {
      console.error("Error depositing funds:", error);
      setNotification({ open: true, message: error.reason || "Gagal menyetor dana.", severity: 'error' });
    }
  };

  const handleOpenSubmitWorkModal = (jobId: number) => {
    setSubmittingWorkId(jobId);
    setSubmitWorkIPFSHash("");
    setIsModalOpen(true);
  };
  
  const handleSubmitWork = async () => {
    if (submittingWorkId === null || !contract || !isConnected) return;
    if (!submitWorkIPFSHash.trim()) {
      setNotification({ open: true, message: "Hash IPFS hasil kerja diperlukan.", severity: 'error' });
      return;
    }
    try {
      const finalIpfsHash = submitWorkIPFSHash.trim();
      const tx = await contract.submitWork(submittingWorkId, finalIpfsHash);
      await tx.wait();
      setNotification({ open: true, message: `Hasil kerja untuk Pekerjaan ID: ${submittingWorkId} berhasil dikirim!`, severity: 'success' });
      fetchJobs();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error submitting work:", error);
      setNotification({ open: true, message: error.reason || "Gagal mengirimkan hasil kerja.", severity: 'error' });
    }
  };

  useEffect(() => {
    if(isConnected) fetchJobs();

    if (contract && provider) {
        const onEvent = () => {
            console.log("Blockchain event received, fetching jobs...");
            fetchJobs();
        };

        const events = ["JobCreated", "FundsDeposited", "WorkSubmitted", "WorkVerified", "FundsReleased"];
        
        events.forEach(event => {
            contract.on(event, onEvent);
        });

        // Cleanup function for useEffect
        return () => {
            if (contract) {
                console.log("Cleaning up event listeners...");
                events.forEach(event => {
                    contract.off(event, onEvent);
                });
            }
        };
    }
  }, [isConnected, contract, provider, fetchJobs]);

  const handleCloseNotification = () => {
    setNotification(null);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Daftar Pekerjaan</Typography>
      {!isConnected && <Alert severity="warning">Harap hubungkan dompet Anda untuk melihat dan berinteraksi dengan pekerjaan.</Alert>}
      {loadingJobs ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : jobs.length === 0 ? (
        <Typography sx={{ textAlign: 'center', my: 4 }}>Belum ada pekerjaan yang dibuat.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Klien</TableCell>
                <TableCell>Freelancer</TableCell>
                <TableCell align="right">Jumlah (AVAX)</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.jobId}>
                  <TableCell>{job.jobId}</TableCell>
                  <TableCell><Link href={`https://testnet.snowtrace.io/address/${job.client}`} target="_blank">{job.client.substring(0, 6)}...</Link></TableCell>
                  <TableCell><Link href={`https://testnet.snowtrace.io/address/${job.freelancer}`} target="_blank">{job.freelancer.substring(0, 6)}...</Link></TableCell>
                  <TableCell align="right">{ethers.formatEther(job.amount)}</TableCell>
                  <TableCell><Chip label={JOB_STATUS_MAP[job.status].label} color={JOB_STATUS_MAP[job.status].color} size="small" /></TableCell>
                  <TableCell>
                    {account === job.client && job.status === 0 && <Button size="small" variant="contained" color="success" onClick={() => handleDeposit(job.jobId, job.amount)}>Setor Dana</Button>}
                    {account === job.freelancer && job.status === 1 && <Button size="small" variant="contained" color="secondary" onClick={() => handleOpenSubmitWorkModal(job.jobId)}>Kirim Kerja</Button>}
                    {account === job.client && job.status === 2 && (
                      <>
                        <Button size="small" variant="contained" color="primary" onClick={() => handleOpenVerifyModal(job.jobId, true)} sx={{ mr: 1 }}>Setujui</Button>
                        <Button size="small" variant="outlined" color="error" onClick={() => handleOpenVerifyModal(job.jobId, false)}>Tolak</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <DialogTitle>Kirim Hasil Kerja (ID: {submittingWorkId})</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Masukkan hash IPFS dari hasil kerja Anda. Pastikan hash ini benar sebelum mengirim.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Hash IPFS Hasil Kerja"
            type="text"
            fullWidth
            variant="standard"
            value={submitWorkIPFSHash}
            onChange={(e) => setSubmitWorkIPFSHash(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsModalOpen(false)}>Batal</Button>
          <Button onClick={handleSubmitWork}>Kirim</Button>
        </DialogActions>
      </Dialog>
      {notification && (
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
            {notification.message}
          </Alert>
        </Snackbar>
      )}

      {/* Dialog for client to verify/reject work */}
      <Dialog open={isVerifyModalOpen} onClose={handleCloseVerifyModal}>
        <DialogTitle>{isApprovedAction ? "Konfirmasi Persetujuan" : "Konfirmasi Penolakan"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Apakah Anda yakin ingin {isApprovedAction ? "menyetujui" : "menolak"} hasil kerja untuk Pekerjaan ID: {jobToVerifyId}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseVerifyModal}>Batal</Button>
          <Button onClick={handleVerifyWork} color={isApprovedAction ? "primary" : "error"} variant="contained">
            {isApprovedAction ? "Setujui" : "Tolak"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default JobList;
