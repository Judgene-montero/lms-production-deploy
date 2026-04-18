import React from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

const PerformanceChart = ({ data = [] }) => {
  return (
    <div className="h-72 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-emerald-900">Quiz Performance</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
          <XAxis dataKey="label" tick={{ fill: "#14532d", fontSize: 10 }} />
          <YAxis tick={{ fill: "#14532d", fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="score" name="Average Score" stroke="#0B6B3A" strokeWidth={2.5} />
          <Line type="monotone" dataKey="target" name="Target" stroke="#84cc16" strokeDasharray="6 6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceChart;
