import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit } from "lucide-react";

interface ProfileCardProps {
  name: string;
  location: string;
  avatarSrc: string;
  onEditProfile: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ name, location, avatarSrc, onEditProfile }) => {
  return (
    <Card className="flex flex-col items-center justify-center p-6 bg-purple-600 text-white rounded-2xl">
      <CardContent className="flex flex-col items-center p-0">
        <Avatar className="w-24 h-24 mb-4">
          <AvatarImage src={avatarSrc} alt={name} />
          <AvatarFallback>{name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <h3 className="text-2xl font-bold">{name}</h3>
        <p className="text-purple-200">{location}</p>
      </CardContent>
      <CardFooter className="p-0 mt-4">
        <Button variant="outline" onClick={onEditProfile} className="bg-transparent border-purple-300 text-white hover:bg-white hover:text-purple-600">
          <Edit className="mr-2 h-4 w-4" />
          Edit profile
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProfileCard;