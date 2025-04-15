import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";


const Header = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const employeeId = localStorage.getItem("employeeId") || sessionStorage.getItem("employeeId"); // Check both



  const handleLogout = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/logout`, {
        method: "POST",
        credentials: "include", // Required for authentication cookies
        headers: {
          "Content-Type": "application/json"
        }
      });
  
      if (response.ok) {
        console.log("Logged out successfully");
        navigate("/"); // Redirect to login
      } else {
        console.error("Error logging out");
      }
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };
  
  const fetchNotifications = useCallback(async () => {
    try {
      if (!employeeId) {
        console.warn("⚠️ No Employee ID found, skipping API call.");
        return;
      }

      console.log("🔍 Fetching notifications for Employee ID:", employeeId);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/notifications/${employeeId}`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Failed to fetch notifications");

      const data = await response.json();
      console.log("📋 Fetched Notifications:", data);

      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async () => {
    if (!employeeId) {
      console.warn("⚠ No Employee ID provided, skipping mark as read.");
      return;
    }

    try {
      console.log("🟢 Marking notifications as read for Employee ID:", employeeId);

      await fetch(`${process.env.REACT_APP_API_URL}/api/notifications/read/${employeeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("❌ Error marking notifications as read:", error);
    }
  };
  
  return (
    <div>
      {/* Navbar */}
      <nav className="main-header navbar navbar-expand navbar-white navbar-light">
        {/* Left navbar links */}
        <ul className="navbar-nav">
          <li className="nav-item">
            <button
              className="nav-link btn"
              data-widget="pushmenu"
              aria-label="Toggle menu"
            >
              <i className="fas fa-bars" />
            </button>
          </li>
          <li className="nav-item d-none d-sm-inline-block">
            <button className="nav-link btn" onClick={() => navigate('')}>
              Home
            </button>
          </li>
          <li className="nav-item d-none d-sm-inline-block">
            <button className="nav-link btn" onClick={() => navigate('')}>
              Contact
            </button>
          </li>
        </ul>

        {/* SEARCH FORM */}
        <form className="form-inline ml-3">
          <div className="input-group input-group-sm">
            <input
              className="form-control form-control-navbar"
              type="search"
              placeholder="Search"
              aria-label="Search"
            />
            <div className="input-group-append">
              <button className="btn btn-navbar" type="submit">
                <i className="fas fa-search" />
              </button>
            </div>
          </div>
        </form>

      

          {/* Right navbar links */}
      <ul className="navbar-nav ml-auto">
        {/* Notifications Dropdown */}
       {/* Notifications Dropdown */}
<li className="nav-item dropdown">
  <button className="nav-link btn dropdown-toggle" data-bs-toggle="dropdown">
    <i className="far fa-bell" />
    {unreadCount > 0 && <span className="badge badge-warning navbar-badge">{unreadCount}</span>}
  </button>
  <ul className="dropdown-menu dropdown-menu-end">
    <li className="dropdown-header">{notifications.length} Notifications</li>
    {notifications.length > 0 ? (
      notifications.slice(0, 5).map((notif) => ( // ✅ Show only the latest 5 notifications
        <li key={notif.id}>
          <button className="dropdown-item">
            <i className="fas fa-envelope mr-2" /> {notif.message}
            <span className="float-right text-muted text-sm">
              {new Date(notif.created_at).toLocaleTimeString()}
            </span>
          </button>
        </li>
      ))
    ) : (
      <li className="dropdown-item text-center">No Notifications</li>
    )}
    <li>
      <button className="dropdown-item text-center" onClick={markAsRead}>Mark All as Read</button>
    </li>
  </ul>
</li>

          {/* User Dropdown */}
          <li className="nav-item dropdown">
            <button
              className="nav-link dropdown-toggle btn"
              id="userDropdown"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="bi bi-person-circle" />
            </button>
            <ul className="dropdown-menu" aria-labelledby="userDropdown">
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Header;
