// src/components/ProgressChart.jsx
import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { week: "Week 1", progress: 60 },
  { week: "Week 2", progress: 70 },
  { week: "Week 3", progress: 75 },
  { week: "Week 4", progress: 85 },
  { week: "Week 5", progress: 90 },
];

const ProgressChart = () => {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-md">
      <h3 className="font-bold text-lg mb-2">📈 Progress Overview</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="progress" stroke="#2563eb" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProgressChart;
