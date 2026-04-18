// src/components/AITipsCard.jsx
import React from "react";

const ai_tips_card = ({ message }) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-400 text-white p-4 rounded-2xl shadow-md">
      <h3 className="font-bold text-lg mb-1">🤖 AI Insights</h3>
      <p>{message}</p>
    </div>
  );
};

export default ai_tips_card;
