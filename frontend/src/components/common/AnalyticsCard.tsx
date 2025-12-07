import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, ArrowRight } from "lucide-react";

interface AnalyticsCardProps {
  performance: number;
  respondRate: number;
  orderCompletion: number;
}

const AnalyticsCard: React.FC<AnalyticsCardProps> = ({ performance, respondRate, orderCompletion }) => {
  const data = [
    { name: 'Performance', value: performance },
    { name: 'Remaining', value: 100 - performance },
  ];

  const COLORS = ['#8884d8', '#f0f0f0']; // Purple for performance, grey for remaining

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Analytics</CardTitle>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                startAngle={90}
                endAngle={450}
                paddingAngle={0}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl font-bold">{performance}%</span>
              <p className="text-xs text-muted-foreground">Performa</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center mt-4">
          <div>
            <p className="text-sm text-muted-foreground">Respond rate</p>
            <p className="text-xl font-bold flex items-center justify-center">
              <MessageSquare className="w-4 h-4 mr-1 text-muted-foreground" />
              {respondRate}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Order completion</p>
            <p className="text-xl font-bold">
              {orderCompletion.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalyticsCard;