import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { BrowserProvider, JsonRpcSigner, Contract, ethers } from "ethers";
import AIEscrowMarketplaceJSON from "../artifacts/AIEscrowMarketplace.json"; // <-- Correct way to import JSON
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

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
      let currentEthereumProvider = window.ethereum;

      // Prioritaskan Core Wallet jika tersedia dan bukan MetaMask
      if (window.ethereum && window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
        currentEthereumProvider = window.ethereum.providers.find((provider: any) => provider.isAvalanche) || window.ethereum;
      } else if (window.ethereum && window.ethereum.isAvalanche) {
        currentEthereumProvider = window.ethereum;
      }
      
      if (currentEthereumProvider) {
        const ethProvider = new ethers.BrowserProvider(currentEthereumProvider);
        setProvider(ethProvider);
                  const network = await ethProvider.getNetwork();
                  // console.log("[DEBUG] Connected to Chain ID:", network.chainId); // Removed
        
                  const accounts = await ethProvider.listAccounts();
                  if (accounts.length > 0) {
                    const connectedSigner = await ethProvider.getSigner();
                    setSigner(connectedSigner);
                    setAccount(connectedSigner.address);
                    setIsConnected(true);
        
                    if (CONTRACT_ADDRESS && AIEscrowMarketplaceABI) {
                      // Check if contract is deployed on the current network
                      const code = await ethProvider.getCode(CONTRACT_ADDRESS);
        
                      if (code === "0x") {
                        const networkName = network.name === "unknown" ? `Chain ID ${network.chainId}` : network.name;
                        const userFriendlyError = `Smart contract tidak ditemukan di jaringan saat ini (${networkName}). Pastikan dompet Anda terhubung ke jaringan yang benar (misalnya Fuji Testnet) dan segarkan halaman.`;
                        setError(userFriendlyError);
                        setIsConnected(false);
                        console.error(userFriendlyError); // Keep error
                        // Stop further execution if contract is not found
                        setIsLoading(false);
                        return; 
                      }
        
                      const escrowContract = new Contract(
                        CONTRACT_ADDRESS,
                        AIEscrowMarketplaceABI,
                        connectedSigner
                      );
                      setContract(escrowContract);
                      // console.log("Web3 initialized successfully."); // Removed
                      // console.log("Provider:", ethProvider); // Removed
                      // console.log("Signer:", connectedSigner); // Removed
                      // console.log("Account:", connectedSigner.address); // Removed
                      // console.log("Contract Instance:", escrowContract); // Removed
                    } else {
                      console.warn("Contract address or ABI not available. Contract instance not created."); // Keep warn
                      setError("Frontend configuration error: Contract Address not found.");
                    }
                  } else {
                    setIsConnected(false);
                    // console.log("No accounts found. Please connect your wallet."); // Removed
                  }
                } else {
                  setError("MetaMask atau dompet Ethereum lain tidak terdeteksi. Silakan instal.");
                  console.warn("MetaMask not detected."); // Keep warn
                }
              } catch (err: any) {
                setError(`Gagal menginisialisasi Web3: ${err.message}`);
                console.error("Error initializing Web3:", err); // Keep error
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
                let currentEthereumProvider = window.ethereum;
        
                if (window.ethereum && window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
                  currentEthereumProvider = window.ethereum.providers.find((provider: any) => provider.isAvalanche) || window.ethereum;
                } else if (window.ethereum && window.ethereum.isAvalanche) {
                  currentEthereumProvider = window.ethereum;
                }
        
                if (!currentEthereumProvider) {
                  setError("Core Wallet atau dompet Ethereum lain tidak terdeteksi. Silakan instal.");
                  setIsLoading(false);
                  return;
                }
        
                await currentEthereumProvider.request({ method: "eth_requestAccounts" });
                await initializeWeb3(); // Re-initialize after connecting
              } catch (err: any) {
                setError(`Gagal menghubungkan dompet: ${err.message}`);
                console.error("Error connecting wallet:", err); // Keep error
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
              // console.log("Wallet disconnected (application state reset)."); // Removed
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
                  // console.log("Chain changed to:", chainId); // Removed
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
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-[350px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memuat Web3...</CardTitle>
              <Spinner className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">Menghubungkan ke dompet Anda dan kontrak pintar.</div>
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center min-h-screen">
          <Card className="w-[350px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-500">Kesalahan Web3</CardTitle>
              <Terminal className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error}
                </AlertDescription>
              </Alert>
              <div className="mt-4 text-center">
                <button
                  onClick={connectWallet}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                  Coba Lagi
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
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
