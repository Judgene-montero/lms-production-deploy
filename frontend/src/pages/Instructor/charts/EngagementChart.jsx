import React from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

const EngagementChart = ({ data = [] }) => {
  return (
    <div className="h-72 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-sm font-semibold text-emerald-900">Engagement Time per Course</h4>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="engagementFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0.08} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#d1fae5" />
          <XAxis dataKey="course" tick={{ fill: "#14532d", fontSize: 10 }} />
          <YAxis tick={{ fill: "#14532d", fontSize: 11 }} />
          <Tooltip />
          <Area dataKey="hours" stroke="#0B6B3A" fill="url(#engagementFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EngagementChart;
