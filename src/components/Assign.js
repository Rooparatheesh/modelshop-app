import React, { useEffect, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";

const Assign = () => {
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [menus, setMenus] = useState([]);
  const [selectedMenus, setSelectedMenus] = useState([]);

  useEffect(() => {
    // Fetch roles
    axios.get(`${process.env.REACT_APP_API_URL}/api/roles`).then((response) => {
      if (response.data.success) {
        setRoles(response.data.roles);
      }
    });

    // Fetch all menus
    axios.get(`${process.env.REACT_APP_API_URL}/api/menus`).then((response) => {
      if (response.data.success) {
        setMenus(response.data.menus);
      }
    });
  }, []);

  const handleRoleChange = (e) => {
    const roleId = e.target.value;
    setSelectedRole(roleId);
    setSelectedMenus([]);
  };

  const handleCheckboxChange = (menuId) => {
    setSelectedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  const handleSubmit = () => {
    if (!selectedRole) {
      Swal.fire("Error!", "Please select a role", "error");
      return;
    }

    axios
      .post(`${process.env.REACT_APP_API_URL}/api/assign-menus`, {
        role_id: selectedRole,
        menu_ids: selectedMenus,
      })
      .then((response) => {
        if (response.data.success) {
          Swal.fire("Success!", response.data.message, "success");
        }
      })
      .catch(() => {
        Swal.fire("Error!", "Error assigning menus", "error");
      });
  };

  return (
    <section className="content">
      <div className="content-wrapper" style={{ padding: "20px" }}>
        <div
          className="card-body"
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            background: "#f8f9fa",
            padding: "30px",
            borderRadius: "10px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
          }}
        >
          <div className="assign-page">
            <h2 style={{ marginBottom: "20px", color: "#293b5f" }}>
              Assign Menus to Roles
            </h2>
  
            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="roleSelect"
                style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}
              >
                Select Role:
              </label>
              <select
                id="roleSelect"
                value={selectedRole}
                onChange={handleRoleChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  fontSize: "16px",
                  borderRadius: "5px",
                  border: "1px solid #ccc"
                }}
              >
                <option value="">-- Select Role --</option>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>
  
            {menus.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ marginBottom: "10px" }}>Menus:</h4>
                {menus.map((menu) => (
                  <div key={menu.menu_id} style={{ marginBottom: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={selectedMenus.includes(menu.menu_id)}
                        onChange={() => handleCheckboxChange(menu.menu_id)}
                        style={{ marginRight: "10px" }}
                      />
                      {menu.menu_name}
                    </label>
                  </div>
                ))}
              </div>
            )}
  
            <button
              onClick={handleSubmit}
              style={{
                backgroundColor: "#293b5f",
                color: "#fff",
                padding: "10px 20px",
                fontSize: "16px",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer"
              }}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </section>
  );
  
};

export default Assign;
