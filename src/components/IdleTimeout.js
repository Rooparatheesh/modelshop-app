import { useEffect } from "react";
import Swal from "sweetalert2";

const IdleTimeout = ({ timeout = 10 * 60 * 1000 }) => { // Default timeout: 10 mins
  useEffect(() => {
    let idleTimer;

    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Logout user when idle
        localStorage.removeItem("jwt_token");

        Swal.fire({
          title: "Session Expired",
          text: "You were logged out due to inactivity.",
          icon: "warning",
          confirmButtonText: "OK",
        }).then(() => {
          window.location.href = "/login"; // Force reload to login page
        });
      }, timeout);
    };

    // Reset timer on user activity
    const handleActivity = () => resetTimer();

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keypress", handleActivity);
    window.addEventListener("scroll", handleActivity);
    window.addEventListener("click", handleActivity);

    resetTimer(); // Start timer on component mount

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keypress", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("click", handleActivity);
    };
  }, [timeout]);

  return null;
};

export default IdleTimeout;
