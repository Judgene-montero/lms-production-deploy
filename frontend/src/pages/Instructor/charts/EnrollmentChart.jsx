import React from "react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const EnrollmentChart = ({ data = [] }) => {
  return (
    <div className="h-72 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-emerald-900">Student Enrollment Growth</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
          <XAxis dataKey="date" tick={{ fill: "#14532d", fontSize: 11 }} />
          <YAxis tick={{ fill: "#14532d", fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#0B6B3A" strokeWidth={3} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EnrollmentChart;
