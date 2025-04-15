import React from 'react';

function Footer() {
  return (
    <footer 
      className="main-footer" 
      style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        padding: "10px", 
        backgroundColor: "#f8f9fa", 
        borderTop: "1px solid #ddd"
      }}
    >
      {/* Left Section with Emblem */}
      <div style={{ display: "flex", alignItems: "center" }}>
      <img src="/image/cdac.png" alt="Emblem" 

          style={{ 
            width: "50px",  // Adjusted size for better visibility
            height: "50px", 
            objectFit: "contain", 
            marginRight: "10px" 
          }} 
        />
        <strong>
          <a href="cdac" style={{ textDecoration: "none", color: "#333" }}>
            Model Shop Workflow Management System
          </a>
        </strong>
      </div>

      
    </footer>
  );
}

export default Footer;
