import React, { useState, } from "react";
import { useNavigate } from "react-router-dom";


import axios from "axios";

const Login = () => {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();  // Prevent form submission default behavior
    setLoading(true);
    setError(null);

    if (!employeeId || !password) {
        setError("Please fill in both Employee ID and Password.");
        setLoading(false);
        return;
    }

    try {
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/login`, {
            employeeId,
            password,
        });

        console.log("API Response:", response.data);

        if (response.data.success) {
            const { token, employeeName, role, permissions, menus } = response.data;

            // Ensure menus is always an array
            const safeMenus = Array.isArray(menus) ? menus : [];

            // Store user info in localStorage
            localStorage.setItem("jwt_token", token);
            localStorage.setItem("employee_name", employeeName);
            localStorage.setItem("role", role);
            localStorage.setItem("permissions", JSON.stringify(permissions || []));
            localStorage.setItem("menus", JSON.stringify(safeMenus));

            // ✅ Always Store `employeeId`
            if (document.getElementById("rememberMe").checked) {
                localStorage.setItem("employeeId", employeeId); // Persist across sessions
            } else {
                sessionStorage.setItem("employeeId", employeeId); // Only for current session
            }

            console.log("Login successful. Redirecting to Dashboard...");
            navigate("/dashboard");
        } else {
            setError(response.data.message);
        }
    } catch (err) {
        console.error("Login error:", err);
        setError(err.response?.data?.message || "An error occurred. Please try again.");
    } finally {
        setLoading(false);
    }
};


  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div className="left-side" style={{ flex: 1, backgroundColor: "white", padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <img src="/image/tick.png" alt="Tick" style={{ width: "80px", marginBottom: "10px" }} />
        <div style={{ textAlign: "center", color: "black", marginBottom: "20px" }}>
          <h1 style={{ fontSize: "2.5em", marginBottom: "10px" }} className="fw-bold">My-Task</h1>
          <p style={{ fontSize: "1.5em" }}>Let's Manage Better</p>
        </div>
        <img src="/image/pi.png" alt="PI" style={{ height: "200px", marginTop: "20px" }} />
      </div>

      <div className="right-side" style={{ flex: 1, padding: "2rem", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div className="sign-in-container" style={{ maxWidth: "400px", padding: "2rem", backgroundColor: "#293b5f", color: "white", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)" }}>
          <h2 className="fw-bold text-center">Sign In</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
            <label htmlFor="employee_id" className="form-label">Employee ID</label>
<input 
  type="text" 
  id="employee_id" 
  className="form-control" 
  placeholder="Enter Employee ID" 
  value={employeeId} 
  onChange={(e) => /^[a-zA-Z0-9-]*$/.test(e.target.value) && setEmployeeId(e.target.value)} 
  required 
/>

            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Password</label>
              <input type="password" id="password" className="form-control" placeholder="***************" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <input type="checkbox" id="rememberMe" />
                <label htmlFor="rememberMe" style={{ marginLeft: "10px", color: "#6c757d" }}>Remember Me</label>
              </div>
              <a href="/pass" className="text-decoration-none" style={{ color: "#ff7f00" }}>Forgot Password?</a>
            </div>
            <div className="d-grid mt-3">
              <button type="submit" className="btn btn-primary btn-lg" style={{ backgroundColor: "#ffffff", color: "#333" }} disabled={loading}>{loading ? "Loading..." : "Sign In"}</button>
            </div>
            {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
            <div className="text-center mt-4">
              <p className="mb-0" style={{ color: "#6c757d" }}>
                Don't have an account yet? <a href="/register" className="text-decoration-none" style={{ color: "#ff7f00" }}>Sign up here</a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
