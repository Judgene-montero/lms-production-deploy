import React from "react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";

const CompletionChart = ({ data = [] }) => {
  return (
    <div className="h-72 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-emerald-900">Course Completion Rate</h4>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
          <XAxis dataKey="course" tick={{ fill: "#14532d", fontSize: 10 }} />
          <YAxis tick={{ fill: "#14532d", fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="rate" fill="#0B6B3A" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CompletionChart;
