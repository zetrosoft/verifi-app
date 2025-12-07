import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ProfileCard from "@/components/common/ProfileCard";
import AnalyticsCard from "@/components/common/AnalyticsCard";
import EarningReportsCard from "@/components/common/EarningReportsCard";
import { ModeToggle } from "@/components/mode-toggle";
import { LayoutDashboard, FileText, Landmark, Users, History, User, Settings, LogOut, Search, Bell, MenuIcon, Download, Banknote } from "lucide-react";

// Import functional components
import JobBoard from "../components/freelancer/JobBoard";
import MyBidsList from "../components/freelancer/MyBidsListComponent";
import ActiveJobs from "../components/freelancer/ActiveJobsComponent";
import JobHistory from "../components/freelancer/JobHistory";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ethers, Contract } from "ethers";

// Constants for USDC payment (Frontend side) - Duplicated from DepositModal, consider centralizing
const USDC_ADDRESS = "0x04A0DC7C7029C647E4279ACcc64D2906D3dB283C"; 
// Minimal ERC20 ABI for balanceOf and decimals
const ERC20_ABI = [
  {"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}
];

const FreelancerDashboard: React.FC = () => {
  const [view, setView] = useState<"overview" | "jobBoard" | "myBids" | "activeJobs" | "jobHistory" | "profile" | "settings">("overview");
  const { account, isConnected, connectWallet, disconnectWallet, isLoading, error: web3Error, provider } = useWeb3();

  // State for balances dropdown
  const [avaxBalance, setAvaxBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [fetchingBalances, setFetchingBalances] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // To control fetching on dropdown open

  useEffect(() => {
    if (!isConnected) {
      setView("overview");
    }
  }, [isConnected]);

  // Fetch balances when account changes or dropdown opens
  useEffect(() => {
    const fetchBalances = async () => {
      if (!isConnected || !account || !provider) {
        setAvaxBalance(null);
        setUsdcBalance(null);
        return;
      }
      setFetchingBalances(true);
      try {
        // Fetch AVAX balance
        const avaxWei = await provider.getBalance(account);
        setAvaxBalance(ethers.formatEther(avaxWei));

        // Fetch USDC balance
        const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const usdcDecimals = await usdcContract.decimals();
        const usdcUnits = await usdcContract.balanceOf(account);
        setUsdcBalance(ethers.formatUnits(usdcUnits, usdcDecimals));

      } catch (err) {
        console.error("Failed to fetch balances:", err);
        setAvaxBalance("Error");
        setUsdcBalance("Error");
      } finally {
        setFetchingBalances(false);
      }
    };

    if (isConnected && account && isDropdownOpen) { // Only fetch if connected and dropdown is open
      fetchBalances();
    } else if (!isDropdownOpen) {
      // Clear balances when dropdown closes
      setAvaxBalance(null);
      setUsdcBalance(null);
    }
  }, [isConnected, account, provider, isDropdownOpen]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    { text: "Dashboard", icon: LayoutDashboard, view: "overview" },
    { text: "Job Board", icon: FileText, view: "jobBoard" },
    { text: "My Bids", icon: Landmark, view: "myBids" },
    { text: "Active Jobs", icon: Users, view: "activeJobs" },
    { text: "Job History", icon: History, view: "jobHistory" },
  ];

  const secondaryNavigationItems = [
    { text: "Profile", icon: User, view: "profile" },
    { text: "Settings", icon: Settings, view: "settings" },
  ];

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <span className="">VeriFi</span>
            </Link>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {navigationItems.map((item) => (
                <Button
                  key={item.text}
                  variant={view === item.view ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setView(item.view)}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.text}
                </Button>
              ))}
            </nav>
          </div>
          <div className="mt-auto p-4 border-t">
            <nav className="grid items-start text-sm font-medium">
              {secondaryNavigationItems.map((item) => (
                <Button
                  key={item.text}
                  variant={view === item.view ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setView(item.view)}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.text}
                </Button>
              ))}
              <Button variant="ghost" className="w-full justify-start" onClick={disconnectWallet}>
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Button>
            </nav>
          </div>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(true)}>
            <MenuIcon className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
          <div className="w-full flex-1">
             <h1 className="text-xl font-semibold">Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            {!isConnected ? (
              <Button onClick={connectWallet} disabled={isLoading}>Connect Wallet</Button>
            ) : (
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-24 justify-end text-sm font-normal">
                    <span className="truncate">{account?.substring(0, 6)}...{account?.substring(account.length - 4)}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Wallet Address</p>
                      <p className="text-xs leading-none text-muted-foreground break-all">
                        {account}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <div className="flex flex-col w-full">
                      <p className="flex items-center text-sm font-medium">
                        <Banknote className="mr-2 h-4 w-4" /> AVAX Balance
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fetchingBalances ? 'Loading...' : avaxBalance !== null ? `${parseFloat(avaxBalance).toFixed(4)} AVAX` : 'N/A'}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <div className="flex flex-col w-full">
                      <p className="flex items-center text-sm font-medium">
                        <Banknote className="mr-2 h-4 w-4" /> USDC Balance
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fetchingBalances ? 'Loading...' : usdcBalance !== null ? `${parseFloat(usdcBalance).toFixed(2)} USDC` : 'N/A'}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={disconnectWallet}>
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <ModeToggle />
            <Avatar>
              <AvatarImage src="https://i.pravatar.cc/150?img=68" alt="John Doe" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <h2 className="text-3xl font-bold">Welcome to Freelancer Dashboard</h2>
              <p className="text-muted-foreground">Connect your Web3 wallet to get started!</p>
              <Button onClick={connectWallet} disabled={isLoading} className="mt-4">
                {isLoading ? 'Connecting...' : 'Connect Wallet'}
              </Button>
              {web3Error && (
                <p className="text-destructive mt-2">
                  Error: {web3Error}
                </p>
              )}
            </div>
          ) : (
            <>
              {view === "overview" && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-3xl font-bold">Welcome back, John! 👋</h2>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="md:col-span-1 lg:col-span-1">
                      <AnalyticsCard performance={90} respondRate={90} orderCompletion={1298} />
                    </div>
                    <div className="md:col-span-1 lg:col-span-1">
                      <EarningReportsCard income={108.9} changePercentage={2.3} />
                    </div>
                    <div className="md:col-span-1 lg:col-span-1">
                      <ProfileCard name="John doe" location="Ca, California" avatarSrc="https://i.pravatar.cc/150?img=68" onEditProfile={() => console.log("Edit profile")} />
                    </div>

                    <div className="md:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Your Active Jobs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ActiveJobs />
                            </CardContent>
                        </Card>
                    </div>
                  </div>
                </>
              )}
              {view === "jobBoard" && <JobBoard />}
              {view === "myBids" && <MyBidsList />}
              {view === "activeJobs" && <ActiveJobs />}
              {view === "jobHistory" && <JobHistory />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default FreelancerDashboard;

