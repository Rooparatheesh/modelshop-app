import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const ForgotPassword = () => {
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!employeeId || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      console.log("Sending request to API:", {
        employee_id: employeeId,
        new_password: password,
        confirm_password: confirmPassword,
      });


      alert("✅ Password reset successful! Redirecting to login...");
      navigate("/login"); // Redirect to login page
    } catch (err) {
      console.error("API Error:", err.response?.data);
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
          <h2 className="fw-bold text-center">Reset Password</h2>
          <form onSubmit={handleResetPassword}>
            {/* ✅ Employee ID Field */}
            <div className="mb-3">
              <label htmlFor="employeeId" className="form-label">Employee ID</label>
              <input 
                type="text" 
                id="employeeId" 
                className="form-control" 
                placeholder="Enter Employee ID" 
                value={employeeId} 
                onChange={(e) => setEmployeeId(e.target.value)} 
                required 
              />
            </div>

            {/* ✅ Password Field */}
            <div className="mb-3">
              <label htmlFor="password" className="form-label">New Password</label>
              <input 
                type="password" 
                id="password" 
                className="form-control" 
                placeholder="Enter New Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>

            {/* ✅ Confirm Password Field */}
            <div className="mb-3">
              <label htmlFor="confirm_password" className="form-label">Re-enter Password</label>
              <input 
                type="password" 
                id="confirm_password" 
                className="form-control" 
                placeholder="Re-enter New Password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required 
              />
            </div>

            <div className="d-grid mt-3">
              <button type="submit" className="btn btn-primary btn-lg" style={{ backgroundColor: "#ffffff", color: "#333" }} disabled={loading}>
                {loading ? "Processing..." : "Reset Password"}
              </button>
            </div>

            {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}

            <div className="text-center mt-4">
              <p className="mb-0" style={{ color: "#6c757d" }}>
                Remember your password? <a href="/login" className="text-decoration-none" style={{ color: "#ff7f00" }}>Sign in here</a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
