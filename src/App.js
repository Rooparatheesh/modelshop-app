import React, { useEffect, useState } from "react";
import "icofont/dist/icofont.min.css";
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from "react-router-dom";
import "./App.css";

import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./components/Home";
import SideNav from "./components/SideNav";
import Login from "./components/Login";
import Table from "./components/Table";
import Assign from "./components/Assign";
import Task from "./components/task";
import Part from "./components/part";
import Taskassign from "./components/taskassign";
import IdleTimeout from "./components/IdleTimeout"; // Import Idle Timeout
import LeaveRequest from "./components/leaverequest";
import Project from "./components/project";
import ForgotPassword from "./components/forgotpass";


function Layout({ children }) {
  return (
    <div>
      <Header />
      <div className="content">
        <SideNav />
        {children}
      </div>
      <Footer />
    </div>
  );
}

// Prevent Back Navigation
const PreventBackNavigation = () => {
  const location = useLocation();

  useEffect(() => {
    const handleBackButton = (event) => {
      event.preventDefault();
      window.history.pushState(null, "", window.location.href);
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handleBackButton);

    return () => {
      window.removeEventListener("popstate", handleBackButton);
    };
  }, [location]);

  return null;
};

function App() {
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  // Check if session expired (from localStorage)
  useEffect(() => {
    if (localStorage.getItem("sessionExpired") === "true") {
      setIsSessionExpired(true);
      localStorage.removeItem("sessionExpired"); // Reset flag after displaying
    }
  }, []);

  // Handle session timeout
  const handleSessionTimeout = () => {
    localStorage.setItem("sessionExpired", "true"); // Set session expired flag
    localStorage.removeItem("authToken"); // Clear authentication (if any)
    window.location.href = "/"; // Redirect to login page
  };

  return (
    <Router>
      <div className="wrapper">
        <Routes>
          {/* Login & Forgot Password (Outside Timeout) ✅ */}
          <Route path="/" element={<Login sessionExpired={isSessionExpired} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes with Idle Timeout & Back Navigation Prevention */}
          <Route
            path="/*"
            element={
              <>
                <IdleTimeout timeout={10 * 60 * 1000} onTimeout={handleSessionTimeout} /> {/* 10 mins idle timeout */}
                <PreventBackNavigation />
                <Routes>
                  <Route path="/dashboard" element={<Layout><Home /></Layout>} />
                  <Route path="/assign" element={<Layout><Assign /></Layout>} />
                  <Route path="/task" element={<Layout><Task /></Layout>} />
                  <Route path="/part" element={<Layout><Part /></Layout>} />
                  <Route path="/table" element={<Layout><Table /></Layout>} />
                  <Route path="/taskassign" element={<Layout><Taskassign /></Layout>} />
                  <Route path="/leaverequest" element={<Layout><LeaveRequest /></Layout>} />
                  <Route path="/project" element={<Layout><Project /></Layout>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
