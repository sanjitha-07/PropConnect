import { createContext, useState, useCallback } from "react";

export const AuthContext = createContext(null);

// Mock user directory. In a real MERN build this would be a MySQL/Mongo
// lookup + hashed password check on the backend.
export const MOCK_USERS = [
  { email: "admin@propconnect.com", password: "admin123", role: "admin", name: "Admin", entityId: null },
  { email: "karthik.raja@mail.com", password: "land123", role: "landlord", name: "Karthik Raja", entityId: "LDL001" },
  { email: "divya.priya@mail.com", password: "tenant123", role: "tenant", name: "Divya Priya", entityId: "TEN001" },
];

export function AuthProvider({ children }) {
  const normalizeUser = (u) => {
    if (!u) return null;
    const fallbackEntityId = u.email === "divya.priya@mail.com" ? "TEN001" : u.email === "karthik.raja@mail.com" ? "LDL001" : null;
    const entityId = u.entityId || u.entity_id || fallbackEntityId;
    return {
      ...u,
      entityId,
      entity_id: entityId,
    };
  };

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("pc-user");
      return stored ? normalizeUser(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  });

  const API_URL = "http://localhost:5000";

  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        const norm = normalizeUser(data.user);
        setUser(norm);
        localStorage.setItem("pc-user", JSON.stringify(norm));
        if (data.token) {
          localStorage.setItem("pc-token", data.token);
        }
        return { success: true, role: data.role };
      }
    } catch (err) {
      console.warn("Backend DB offline, fallback to local lookup:", err);
    }

    const found = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
    );
    if (found) {
      const norm = normalizeUser(found);
      setUser(norm);
      localStorage.setItem("pc-user", JSON.stringify(norm));
      return { success: true, role: found.role };
    }
    return { success: false };
  }, []);

  const loginWithGoogle = useCallback(async (googleAccount) => {
    const email = typeof googleAccount === "string" ? "google.user@propconnect.com" : googleAccount?.email || "google.user@gmail.com";
    const name = typeof googleAccount === "object" ? googleAccount.name : "Google User";
    const role = typeof googleAccount === "object" ? googleAccount.role : "landlord";

    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role }),
      });
      const data = await res.json();
      if (data.success) {
        const norm = normalizeUser(data.user);
        setUser(norm);
        localStorage.setItem("pc-user", JSON.stringify(norm));
        if (data.token) {
          localStorage.setItem("pc-token", data.token);
        }
        return { success: true, role: data.role };
      }
    } catch (err) {
      console.warn("Backend DB offline, fallback to Google mock:", err);
    }

    let googleUser;
    if (typeof googleAccount === "string") {
      const defaultByRole = MOCK_USERS.find((u) => u.role === googleAccount) || MOCK_USERS[1];
      googleUser = {
        ...defaultByRole,
        name: `${defaultByRole.name} (Google)`,
        isGoogle: true,
      };
    } else if (googleAccount && typeof googleAccount === "object") {
      const matchingMock = MOCK_USERS.find((u) => u.role === googleAccount.role) || MOCK_USERS[1];
      googleUser = {
        ...matchingMock,
        name: googleAccount.name || matchingMock.name,
        email: googleAccount.email || matchingMock.email,
        role: googleAccount.role || matchingMock.role,
        isGoogle: true,
      };
    } else {
      googleUser = { ...MOCK_USERS[1], isGoogle: true };
    }
    const norm = normalizeUser(googleUser);
    setUser(norm);
    localStorage.setItem("pc-user", JSON.stringify(norm));
    return { success: true, role: norm.role };
  }, []);

  const registerTenantAccount = useCallback(async (tenantData) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tenantData),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const norm = normalizeUser(data.user);
        setUser(norm);
        localStorage.setItem("pc-user", JSON.stringify(norm));
        if (data.token) {
          localStorage.setItem("pc-token", data.token);
        }
        return { success: true, user: norm, role: "tenant", message: data.message };
      }
      return { success: false, message: data.message || "Registration failed" };
    } catch (err) {
      return { success: false, message: "Unable to connect to PropConnect server. Please check connection." };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("pc-user");
    localStorage.removeItem("pc-token");
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, registerTenant: registerTenantAccount, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
