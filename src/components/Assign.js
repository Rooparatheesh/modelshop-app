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
      <div className="content-wrapper">
        <div className="card-body">
          <div className="assign-page">
            <h3>Assign Menus to Roles</h3>
            <div>
              <label>Select Role:</label>
              <select value={selectedRole} onChange={handleRoleChange}>
                <option value="">-- Select Role --</option>
                {roles.map((role) => (
                  <option key={role.role_id} value={role.role_id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </div>

            {menus.length > 0 && (
              <div>
                <h3>Menus:</h3>
                {menus.map((menu) => (
                  <div key={menu.menu_id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedMenus.includes(menu.menu_id)}
                        onChange={() => handleCheckboxChange(menu.menu_id)}
                      />
                      {menu.menu_name}
                    </label>
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleSubmit}>Submit</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Assign;
