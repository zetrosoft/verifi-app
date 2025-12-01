/**
 * @module IPFSService
 * @description Layanan untuk berinteraksi dengan IPFS Gateway API untuk mengunggah file.
 * Menggunakan fetch API untuk mengirim data ke endpoint /api/v0/add dari node IPFS.
 */

// Mendapatkan URL API IPFS dari variabel lingkungan
// Asumsikan VITE_IPFS_API_URL telah diatur di file .env frontend Anda
// Contoh: VITE_IPFS_API_URL="http://localhost:5001" (untuk node IPFS lokal)
const IPFS_API_URL = import.meta.env.VITE_IPFS_API_URL;

if (!IPFS_API_URL) {
  console.warn("VITE_IPFS_API_URL tidak didefinisikan di lingkungan. Unggahan IPFS mungkin tidak berfungsi.");
}

/**
 * @function uploadFileToIPFS
 * @description Mengunggah file (atau data teks) ke IPFS dan mengembalikan hash IPFS (CID).
 * @param {File | string} fileData File objek atau string teks yang akan diunggah.
 * @param {string} [fileName] Nama file opsional.
 * @returns {Promise<string | null>} Hash IPFS (CID) dari konten yang diunggah, atau null jika gagal.
 */
export const uploadFileToIPFS = async (fileData: File | string, fileName?: string): Promise<string | null> => {
  if (!IPFS_API_URL) {
    console.error("IPFS API URL tidak dikonfigurasi. Gagal mengunggah ke IPFS.");
    return null;
  }

  const url = `${IPFS_API_URL}/api/v0/add`;
  const formData = new FormData();

  let blob: Blob;
  let filenameToUse: string;

  if (typeof fileData === 'string') {
    // Jika fileData adalah string, ubah menjadi Blob
    blob = new Blob([fileData], { type: 'text/plain' });
    filenameToUse = fileName || 'description.txt';
  } else {
    // Jika fileData adalah objek File
    blob = fileData;
    filenameToUse = fileName || fileData.name || 'file';
  }

  formData.append("file", blob, filenameToUse);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gagal mengunggah ke IPFS: ${response.status} ${response.statusText}`, errorText);
      return null;
    }

    // IPFS add API mengembalikan objek JSON dengan Hash, Name, Size
    const data = await response.json();
    console.log("File berhasil diunggah ke IPFS:", data);
    return data.Hash; // Mengembalikan hash IPFS (CID)
  } catch (error) {
    console.error("Kesalahan saat koneksi atau mengunggah ke IPFS:", error);
    return null;
  }
};
