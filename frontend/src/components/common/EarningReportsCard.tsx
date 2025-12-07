import * as React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowUp } from "lucide-react";

interface EarningReportsCardProps {
  income: number;
  changePercentage: number;
}

const data = [
  { name: 'Jan', income: 4000 },
  { name: 'Feb', income: 3000 },
  { name: 'Mar', income: 5000 },
  { name: 'Apr', income: 4500 },
  { name: 'May', income: 6000 },
  { name: 'Jun', income: 5500 },
  { name: 'Jul', income: 7000 },
  { name: 'Aug', income: 6500 },
  { name: 'Sep', income: 7500 },
  { name: 'Oct', income: 8000 },
  { name: 'Nov', income: 8500 },
  { name: 'Dec', income: 9000 },
];

const EarningReportsCard: React.FC<EarningReportsCardProps> = ({ income, changePercentage }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Earning reports</CardTitle>
        <CardDescription>Income in 2024</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline space-x-2">
          <span className="text-3xl font-bold">${income.toLocaleString()}k</span>
          <span className="flex items-center text-sm text-green-500">
            <ArrowUp className="w-4 h-4" />
            {changePercentage}%
          </span>
        </div>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#888' }} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000}k`} tick={{ fill: '#888' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Line type="monotone" dataKey="income" stroke="#8884d8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default EarningReportsCard;