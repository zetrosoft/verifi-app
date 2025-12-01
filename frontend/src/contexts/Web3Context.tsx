import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { BrowserProvider, JsonRpcSigner, Contract, ethers } from "ethers";
import AIEscrowMarketplaceJSON from "../artifacts/AIEscrowMarketplace.json"; // <-- Correct way to import JSON

// Mendapatkan variabel lingkungan dari Vite
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const AIEscrowMarketplaceABI = AIEscrowMarketplaceJSON.abi; // <-- Access the abi property

/**
 * @interface Web3ContextType
 * @description Mendefinisikan struktur data untuk konteks Web3.
 */
interface Web3ContextType {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  contract: Contract | null;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
  error: string | null;
}

// Membuat konteks Web3 dengan nilai default
const Web3Context = createContext<Web3ContextType | undefined>(undefined);

/**
 * @function useWeb3
 * @description Hook kustom untuk mengakses konteks Web3.
 * @returns {Web3ContextType} Objek konteks Web3.
 * @throws {Error} Jika hook digunakan di luar `Web3Provider`.
 */
export const useWeb3 = (): Web3ContextType => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
};

/**
 * @component Web3Provider
 * @description Komponen provider untuk menyediakan konteks Web3 ke seluruh aplikasi.
 * Menangani koneksi dompet (MetaMask), interaksi kontrak, dan pembaruan state.
 * @param {object} props Properti komponen.
 * @param {ReactNode} props.children Children yang akan dirender di dalam provider.
 */
export const Web3Provider = ({ children }: { children: ReactNode }) => {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * @function initializeWeb3
   * @description Menginisialisasi koneksi Web3 dan kontrak jika dompet terhubung.
   */
  const initializeWeb3 = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Memeriksa apakah MetaMask terinstal
      if (window.ethereum) {
        const ethProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(ethProvider);
        const network = await ethProvider.getNetwork();
        console.log("[DEBUG] Connected to Chain ID:", network.chainId);

        const accounts = await ethProvider.listAccounts();
        if (accounts.length > 0) {
          const connectedSigner = await ethProvider.getSigner();
          setSigner(connectedSigner);
          setAccount(connectedSigner.address);
          setIsConnected(true);

                    if (CONTRACT_ADDRESS && AIEscrowMarketplaceABI) {            const escrowContract = new Contract(
              CONTRACT_ADDRESS,
              AIEscrowMarketplaceABI,
              connectedSigner
            );
            setContract(escrowContract);
            console.log("Web3 initialized with connected wallet and contract.");
          } else {
            console.warn("Contract address or ABI not available. Contract instance not created.");
          }
        } else {
          setIsConnected(false);
          console.log("No accounts found. Please connect your wallet.");
        }
      } else {
        setError("MetaMask atau dompet Ethereum lain tidak terdeteksi. Silakan instal.");
        console.warn("MetaMask not detected.");
      }
    } catch (err: any) {
      setError(`Gagal menginisialisasi Web3: ${err.message}`);
      console.error("Error initializing Web3:", err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @function connectWallet
   * @description Menghubungkan dompet pengguna (MetaMask).
   */
  const connectWallet = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!window.ethereum) {
        setError("MetaMask tidak terdeteksi. Silakan instal.");
        setIsLoading(false);
        return;
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      await initializeWeb3(); // Re-initialize after connecting
    } catch (err: any) {
      setError(`Gagal menghubungkan dompet: ${err.message}`);
      console.error("Error connecting wallet:", err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @function disconnectWallet
   * @description Memutuskan koneksi dompet pengguna.
   * Saat ini, MetaMask tidak memiliki metode 'disconnect' langsung.
   * Ini akan mereset state lokal aplikasi.
   */
  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setContract(null);
    setIsConnected(false);
    setError(null);
    console.log("Wallet disconnected (application state reset).");
  };

  useEffect(() => {
    initializeWeb3();

    // Menambahkan event listener untuk perubahan akun atau rantai
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          initializeWeb3();
        }
      });

      window.ethereum.on("chainChanged", (chainId: string) => {
        console.log("Chain changed to:", chainId);
        initializeWeb3();
      });

      return () => {
        if (window.ethereum.removeListener) {
            window.ethereum.removeListener("accountsChanged", initializeWeb3);
            window.ethereum.removeListener("chainChanged", initializeWeb3);
        }
      };
    }
  }, []); // Hanya dijalankan saat komponen mount

  const contextValue: Web3ContextType = {
    provider,
    signer,
    account,
    contract,
    isConnected,
    connectWallet,
    disconnectWallet,
    isLoading,
    error,
  };

  return (
    <Web3Context.Provider value={contextValue}>
      {isLoading ? (
        <div style={{ padding: "20px", textAlign: "center" }}>Memuat Web3...</div>
      ) : (
        children
      )}
    </Web3Context.Provider>
  );
};

// Deklarasi global window.ethereum untuk TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
