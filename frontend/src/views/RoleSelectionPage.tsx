import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button"; // Import shadcn Button
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Import shadcn Card components

const RoleSelectionPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSelectRole = (role: 'client' | 'freelancer') => {
    if (role === 'client') {
      navigate('/client-dashboard');
    } else {
      navigate('/freelancer-dashboard');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-[450px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to VeriFi: AI Escrow Marketplace</CardTitle>
          <CardDescription>
            Please select your role to proceed to the dashboard.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center space-x-4 p-6">
          <Button size="lg" onClick={() => handleSelectRole('client')}>
            Enter as Client
          </Button>
          <Button size="lg" variant="outline" onClick={() => handleSelectRole('freelancer')}>
            Enter as Freelancer
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default RoleSelectionPage;