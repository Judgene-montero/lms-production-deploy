import React, { useEffect, useState } from "react";
import { authGet } from "../../utils/api";

const InstructorNotifications = () => {
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    authGet("/api/dashboards/instructor/notifications/")
      .then(setNotifs)
      .catch((err) => console.log("Notification error:", err));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">Notifications</h1>

      {notifs.length === 0 && <p>No notifications yet.</p>}

      {notifs.map((n) => (
        <div key={n.id} className="p-4 border-b">
          <p>{n.message}</p>
        </div>
      ))}
    </div>
  );
};

export default InstructorNotifications;
