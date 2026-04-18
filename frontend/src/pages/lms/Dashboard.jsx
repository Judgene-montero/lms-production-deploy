import useAuth from "../../hooks/useAuth";

export default function Dashboard() {
  const user = useAuth();

  if (!user) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome, {user.first_name} 👋</h1>

      <div className="mt-4 p-4 bg-gray-50 border rounded">
        <p><strong>Student ID:</strong> {user.school_id}</p>
        <p><strong>Role:</strong> {user.role}</p>
      </div>
    </div>
  );
}
