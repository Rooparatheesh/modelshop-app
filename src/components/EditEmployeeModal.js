import React, { useState, useEffect } from "react";
import axios from "axios";
import Swal from "sweetalert2";

const EditEmployeeModal = ({ employee, onClose, onUpdate }) => {
  const [updatedEmployee, setUpdatedEmployee] = useState({
    employee_id: employee.employee_id,
    employee_name: employee.employee_name,
    designation: employee.designation,
    email_id: employee.email_id,
    phone_number: employee.phone_number,
  });

  const [selectedTrade, setSelectedTrade] = useState("");
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch trades and employee's current trade
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 🔹 Fetch all trades
        const tradesResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/trades`);
        setTrades(tradesResponse.data);

        // 🔹 Fetch employee's assigned trade
        const tradeResponse = await axios.get(`${process.env.REACT_APP_API_URL}/api/employee_trade/${employee.employee_id}`);
        if (tradeResponse.data && tradeResponse.data.trade_id) {
          setSelectedTrade(String(tradeResponse.data.trade_id)); // Convert to string
        } else {
          setSelectedTrade(""); // Reset if no trade found
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setSelectedTrade(""); // Reset on error
      }
    };

    fetchData();
  }, [employee.employee_id]);

   // Ensure selectedTrade updates when trades are loaded
   useEffect(() => {
    if (trades.length > 0 && selectedTrade === "") {
      const assignedTrade = trades.find(trade => trade.trade_id === employee.trade_id);
      if (assignedTrade) {
        setSelectedTrade(String(assignedTrade.trade_id));
      }
    }
  }, [trades, employee.trade_id, selectedTrade]); // Added selectedTrade to the dependency array


  const handleChange = (e) => {
    const { id, value } = e.target;
    setUpdatedEmployee({
      ...updatedEmployee,
      [id]: value,
    });
  };

  const handleTradeChange = (e) => {
    setSelectedTrade(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!updatedEmployee.employee_name || !updatedEmployee.designation || !updatedEmployee.email_id || !updatedEmployee.phone_number || !selectedTrade) {
      setErrorMessage("All fields including trade selection are required.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const token = localStorage.getItem("jwt_token");
    if (!token) {
      setErrorMessage("No token found. Please login.");
      setLoading(false);
      return;
    }

    try {
      console.log("Updated employee data:", updatedEmployee);

      // 🔹 Update Employee Details
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/employees/${updatedEmployee.employee_id}`,
        updatedEmployee,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 🔹 Update Trade in trade_employee Table
      const tradeResponse = await axios.put(
        `${process.env.REACT_APP_API_URL}/api/trade_employee`,
        { employee_id: updatedEmployee.employee_id, trade_id: selectedTrade },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success && tradeResponse.data.success) {
        // ✅ Show Success Message
        Swal.fire({
          title: "Success!",
          text: "Employee updated successfully!",
          icon: "success",
          confirmButtonText: "OK",
        });

        // ✅ Instantly update UI
        if (typeof onUpdate === "function") {
          const selectedTradeName = trades.find(trade => trade.trade_id === selectedTrade)?.trade_name || "Not Assigned";
          onUpdate({ ...updatedEmployee, trade_id: selectedTrade, trade_name: selectedTradeName });
        }

        onClose(); // ✅ Close Modal After Update
      } else {
        setErrorMessage(response.data.message || "Failed to update employee.");
      }
    } catch (error) {
      console.error("Error updating employee:", error.response ? error.response.data : error.message);
      setErrorMessage("Error updating employee. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" role="dialog" id="editEmployeeModal" tabIndex="-1">
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Profile</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {errorMessage && <div className="alert alert-danger">{errorMessage}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="employee_name" className="form-label">Employee Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="employee_name"
                  value={updatedEmployee.employee_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="designation" className="form-label">Designation</label>
                <input
                  type="text"
                  className="form-control"
                  id="designation"
                  value={updatedEmployee.designation}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="email_id" className="form-label">Email ID</label>
                <input
                  type="email"
                  className="form-control"
                  id="email_id"
                  value={updatedEmployee.email_id}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="phone_number" className="form-label">Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  id="phone_number"
                  value={updatedEmployee.phone_number}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Trade</label>
                <select className="form-select" value={selectedTrade} onChange={handleTradeChange} required>
                  <option value="">Select Trade</option>
                  {trades.map((trade) => (
                    <option key={trade.trade_id} value={String(trade.trade_id)}>{trade.trade_name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditEmployeeModal;
