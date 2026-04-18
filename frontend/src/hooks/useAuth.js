import { useEffect, useState } from "react";
import axios from "../utils/axiosInstance";

const API_URL = "/api/users/me/";

export default function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      setUser(null);
      return;
    }

    axios.get(API_URL)
    .then(res => setUser(res.data))
    .catch(() => setUser(null));
  }, []);

  return user;
}

