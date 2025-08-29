import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";

const NewEmployeeModal = ({ onClose, onAddEmployee }) => {
  const [employee, setEmployee] = useState({
    employee_id: "",
    employee_name: "",
    designation: "",
    email_id: "",
    phone_number: "",
    trade_id: "",
  });

  const [trades, setTrades] = useState([]); // State to store trades

  // Fetch trades from trade_master table
  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/trades`);
        setTrades(response.data);
      } catch (error) {
        console.error("Error fetching trades:", error);
        Swal.fire("Error!", "Failed to load trades.", "error");
      }
    };

    fetchTrades();
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { id, value } = e.target;
    setEmployee({
      ...employee,
      [id]: value,
    });
  };

  // Submit the form
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      console.log("New Employee Data:", employee);

      const token = localStorage.getItem("jwt_token");
      if (!token) {
        Swal.fire("Error!", "You need to be logged in to add an employee.", "error");
        return;
      }

      // Validate required fields
      if (!employee.employee_id || !employee.employee_name || !employee.designation || !employee.email_id || !employee.phone_number || !employee.trade_id) {
        Swal.fire("Warning!", "All employee fields are required.", "warning");
        return;
      }

      // API call to add employee
      const employeeResponse = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/employees`,
        employee,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (employeeResponse.data.success) {
        const newEmployeeId = employee.employee_id;

        // Assign employee to trade
        await axios.post(
          `${process.env.REACT_APP_API_URL}/api/trade_employee`,
          {
            employee_id: newEmployeeId,
            trade_id: employee.trade_id,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Get the trade name from the trades list
        const tradeName = trades.find((trade) => trade.trade_id === employee.trade_id)?.trade_name || "";

        // Update parent state instantly
        onAddEmployee({ ...employee, trade_name: tradeName });

        Swal.fire("Success!", "Employee added successfully!", "success").then(() => {
          onClose();
        });
      } else {
        Swal.fire("Error!", employeeResponse.data.message || "Failed to add employee.", "error");
      }
    } catch (error) {
      console.error("Error adding employee:", error);
      if (error.response) {
        Swal.fire("Error!", `Server error: ${error.response.data.message || "An error occurred."}`, "error");
      } else if (error.request) {
        Swal.fire("Error!", "No response from server. Please check your connection.", "error");
      } else {
        Swal.fire("Error!", "An unexpected error occurred. Please try again.", "error");
      }
    }
  };

  return (
    <div className="modal show d-block" role="dialog">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">New Employee</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="employee_id" className="form-label">Employee ID</label>
                <input type="text" className="form-control" id="employee_id" value={employee.employee_id} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="employee_name" className="form-label">Employee Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="employee_name"
                  value={employee.employee_name}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^a-zA-Z\s]/g, "").replace(/\s+/g, " ").trim();
                    value = value.replace(/\b\w/g, (char) => char.toUpperCase());
                    handleChange({ target: { id: "employee_name", value } });
                  }}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="designation" className="form-label">Designation</label>
                <input
                  type="text"
                  className="form-control"
                  id="designation"
                  value={employee.designation}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^a-zA-Z()\s]/g, "").replace(/\s+/g, " ").trim();
                    value = value.replace(/\b\w/g, (char) => char.toUpperCase());
                    handleChange({ target: { id: "designation", value } });
                  }}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="email_id" className="form-label">Email ID</label>
                <input type="email" className="form-control" id="email_id" value={employee.email_id} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="phone_number" className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  id="phone_number"
                  value={employee.phone_number}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,10}$/.test(value)) {
                      handleChange(e);
                    }
                  }}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="trade_id" className="form-label">Trade</label>
                <select className="form-control" id="trade_id" value={employee.trade_id} onChange={handleChange} required>
                  <option value="">Select Trade</option>
                  {trades.map((trade) => (
                    <option key={trade.trade_id} value={trade.trade_id}>{trade.trade_name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <button type="submit" className="btn btn-primary">Add Employee</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewEmployeeModal;
