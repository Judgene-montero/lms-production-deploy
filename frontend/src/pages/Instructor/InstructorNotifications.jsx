import React from "react";
import useNotifications from "../../hooks/useNotifications";

const InstructorNotifications = () => {
  const { notifications, loading, markAsRead } = useNotifications();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Notifications</h1>

      {!loading && notifications.length === 0 && <p>No notifications yet.</p>}

      {notifications.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => markAsRead(item.id)}
          className={`block w-full border-b p-4 text-left ${item.isRead ? "bg-white" : "bg-emerald-50/40"}`}
        >
          <p className="font-semibold">{item.title}</p>
          <p>{item.message}</p>
        </button>
      ))}
    </div>
  );
};

export default InstructorNotifications;
