import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "../../utils/axiosInstance";

export default function Modules() {
  const { id } = useParams();
  const [modules, setModules] = useState([]);

  useEffect(() => {
    axios
      .get(`/api/student/course/${id}/modules/`)
      .then((res) => setModules(res.data))
      .catch(console.error);
  }, [id]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Modules</h1>
      {modules.map((module) => (
        <div key={module.id} className="bg-white p-4 shadow rounded mb-3">
          {module.title}
        </div>
      ))}
    </div>
  );
}

