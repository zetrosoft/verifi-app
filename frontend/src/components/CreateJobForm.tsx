import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Stack,
  Typography,
  Snackbar,
  Alert,
} from "@mui/material";
import { ethers } from "ethers";
import { useWeb3 } from "../contexts/Web3Context";
import { uploadFileToIPFS } from "../services/IPFSService";

/**
 * @component CreateJobForm
 * @description Komponen formulir untuk klien membuat pekerjaan baru di marketplace escrow, menggunakan Material-UI.
 * Mengunggah deskripsi pekerjaan ke IPFS dan memanggil fungsi `createJob` pada kontrak pintar.
 */
const CreateJobForm: React.FC = () => {
  const { contract, account, isConnected, isLoading } = useWeb3();

  const [freelancerAddress, setFreelancerAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("0.01");
  const [workDescription, setWorkDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  /**
   * @function handleSubmit
   * @description Menangani pengiriman formulir untuk membuat pekerjaan baru.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !contract || !account) {
      setNotification({ open: true, message: "Harap hubungkan dompet Anda.", severity: "error" });
      return;
    }

    if (!ethers.isAddress(freelancerAddress)) {
      setNotification({ open: true, message: "Alamat Freelancer tidak valid.", severity: "error" });
      return;
    }

    if (parseFloat(amount) <= 0) {
      setNotification({ open: true, message: "Jumlah pembayaran harus lebih besar dari nol.", severity: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const ipfsHash = await uploadFileToIPFS(workDescription, `job_description_${Date.now()}.txt`);
      if (!ipfsHash) {
        throw new Error("Gagal mengunggah deskripsi pekerjaan ke IPFS.");
      }

      const tx = await contract.createJob(
        freelancerAddress,
        ethers.parseEther(amount),
        ipfsHash
      );
      await tx.wait();

      setNotification({ open: true, message: "Pekerjaan berhasil dibuat!", severity: "success" });
      setFreelancerAddress("");
      setAmount("0.01");
      setWorkDescription("");
    } catch (error: any) {
      console.error("Kesalahan saat membuat pekerjaan:", error);
      setNotification({ open: true, message: error.reason || error.message || "Gagal membuat pekerjaan.", severity: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification(null);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, border: '1px solid grey', borderRadius: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Buat Pekerjaan Baru</Typography>
        <TextField
          label="Alamat Freelancer"
          variant="outlined"
          fullWidth
          required
          value={freelancerAddress}
          onChange={(e) => setFreelancerAddress(e.target.value)}
          placeholder="0x..."
        />
        <TextField
          label="Jumlah Pembayaran (AVAX)"
          variant="outlined"
          type="number"
          fullWidth
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputProps={{ step: "0.001", min: "0.001" }}
        />
        <TextField
          label="Deskripsi Pekerjaan (IPFS)"
          variant="outlined"
          fullWidth
          required
          multiline
          rows={4}
          value={workDescription}
          onChange={(e) => setWorkDescription(e.target.value)}
          placeholder="Deskripsi detail pekerjaan..."
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={!isConnected || isSubmitting || isLoading}
          fullWidth
        >
          {isSubmitting ? "Membuat..." : "Buat Pekerjaan"}
        </Button>
      </Stack>
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
    </Box>
  );
};

export default CreateJobForm;
