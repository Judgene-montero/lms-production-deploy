import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { LuBell } from "react-icons/lu";
import DashboardLayouts from "../../layouts/DashboardLayouts";
import StudentSidebar from "../../components/student/StudentSidebar";
import SafeAvatarImage from "../../components/common/SafeAvatarImage";
import {
  getDefaultStudentAvatarDataUrl,
  loadStudentProfile,
  resolveStudentAvatar,
  subscribeStudentProfile,
} from "../../utils/studentProfile";
import useNotifications from "../../hooks/useNotifications";

const SidebarSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 rounded-full bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-gray-200" />
        <div className="h-3 w-1/3 rounded bg-gray-200" />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="h-12 rounded bg-gray-200" />
      <div className="h-12 rounded bg-gray-200" />
      <div className="h-12 rounded bg-gray-200" />
      <div className="h-12 rounded bg-gray-200" />
    </div>

    <div className="h-2 rounded bg-gray-200" />
    <div className="h-20 rounded bg-gray-200" />
  </div>
);

const ProfileHeader = ({ student }) => (
  <div className="flex items-center gap-4">
    <div>
      <SafeAvatarImage
        src={resolveStudentAvatar(student || {}) || getDefaultStudentAvatarDataUrl(student || {})}
        fallbackSrc={getDefaultStudentAvatarDataUrl(student || {})}
        alt="Avatar"
        className="h-16 w-16 rounded-full border-2 border-emerald-500 object-cover"
      />
    </div>

    <div>
      <h4 className="text-lg font-semibold text-gray-800">
        {student?.first_name} {student?.last_name}
      </h4>
      <p className="text-sm text-gray-500">{student?.major || "Student"}</p>
    </div>
  </div>
);

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await loadStudentProfile();
        setStudentData(res);
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    const unsubscribe = subscribeStudentProfile((nextProfile) => setStudentData(nextProfile));
    return unsubscribe;
  }, []);

  const rightSidebar = (
    <aside className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-md lg:sticky lg:top-6 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:p-6">
      {loading ? (
        <SidebarSkeleton />
      ) : (
        <>
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <ProfileHeader student={studentData} />
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                className="relative rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-emerald-700 transition hover:bg-emerald-100"
                aria-label="Open notifications"
              >
                <LuBell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
            </div>

            {notificationsOpen ? (
              <div className="absolute right-0 top-14 z-30 w-full rounded-xl border border-emerald-100 bg-white p-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900">Notifications</p>
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">No alerts right now.</p>
                  ) : (
                    notifications.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          markAsRead(item.id);
                          setNotificationsOpen(false);
                          if (item.target?.pathname) {
                            navigate(item.target.pathname, { state: item.target.state });
                          }
                        }}
                        className={`block w-full rounded-lg border p-3 text-left transition ${
                          item.isRead ? "border-gray-100 bg-gray-50" : "border-emerald-100 bg-emerald-50/50"
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        <p className="mt-1 text-xs text-gray-600">{item.message}</p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : "Just now"}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </aside>
  );

  return (
    <DashboardLayouts sidebar={<StudentSidebar />} right={rightSidebar}>
      <Outlet />
    </DashboardLayouts>
  );
};

export default StudentDashboard;
