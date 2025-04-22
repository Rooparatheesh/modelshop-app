import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import axios from "axios";
import Swal from "sweetalert2";


const LeaveRequest = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  

  useEffect(() => {
    fetchLeaveRequests();
    fetchLeaveTypes();
  }, []);

  const fetchLeaveRequests = async () => {
    const { data } = await axios.get("/api/leaverequests");
    setLeaveRequests(data);
  };
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  const handleEntriesChange = (e) => {
    setEntriesPerPage(Number(e.target.value));
  };
  
  // Fetch leave types from API
  const fetchLeaveTypes = async () => {
    try {
      const { data } = await axios.get("/api/leave_master");
      setLeaveTypes(data);
    } catch (error) {
      console.error("❌ Error fetching leave types:", error);
    }
  };

  

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      leaveRequests.map(({ id, emp_id, emp_name, leave_type, start_date, end_date, reason, status }) => ({
        "SL.NO": id,
        "Employee ID": emp_id,
        "Employee Name": emp_name,
        "Leave Type": leave_type,
        "From": start_date,
        "To": end_date,
        "Reason": reason,
        "Status": status,
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leave Requests");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, "LeaveRequests.xlsx");
  };

  const handleDelete = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          console.log("Deleting leave request with ID:", id);
          await axios.delete(`/api/leaverequests/${id}`);
          fetchLeaveRequests();
          Swal.fire("Deleted!", "The leave request has been deleted.", "success");
        } catch (error) {
          console.error("❌ Error deleting leave request:", error.response?.data || error.message);
          Swal.fire("Error!", "Failed to delete leave request.", "error");
        }
      }
    });
  };

  const handleApprove = async (id) => {
    Swal.fire({
      title: "Approve Leave Request?",
      text: "This action cannot be undone.",
      icon: "info",
      showCancelButton: true,
      confirmButtonColor: "#28a745",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, approve it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.put(`/api/leaverequests/${id}`, { status: "Approved" });
          fetchLeaveRequests();
          Swal.fire("Approved!", "The leave request has been approved.", "success");
        } catch (error) {
          console.error("❌ Error approving leave request:", error);
          Swal.fire("Error!", "Failed to approve leave request.", "error");
        }
      }
    });
  };

  const filteredLeaveRequests = leaveRequests.filter((request) =>
    request.emp_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  return (
    
    <section className="content">
      <div className="content-wrapper">
        <div className="card-body">
        <div className="row mb-3">
  <div className="col-md-6 d-flex align-items-center">
    <label htmlFor="entries" className="form-label me-2">Show</label>
    <select 
      id="entries" 
      className="form-select form-select-sm w-auto d-inline" 
      onChange={handleEntriesChange}
    >
      <option value="10">10</option>
      <option value="25">25</option>
      <option value="50">50</option>
      <option value="100">100</option>
    </select>
   
  </div>
</div>

 
      

      <div className="row mb-3">
        <div className="col-md-4">
          <Button variant="success" onClick={exportToExcel}>Export to Excel</Button>
        </div>
        <div className="col-md-6 text-md-end">
              <label htmlFor="search" className="form-label me-2">Search:</label>
              <input
                type="search"
                id="search"
                className="form-control form-control-sm d-inline w-auto"
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </div>
      </div>

      <table className="table table-bordered">
        <thead>
          <tr>
            <th>SL.NO</th>
            <th>Employee ID</th>
            <th>Employee Name</th>
            <th>Leave Type</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
  {filteredLeaveRequests.map((request, index) => (
    <tr key={request.id}>
      <td>{index + 1}</td>
      <td>{request.emp_id}</td>
      <td>{request.emp_name}</td>
      <td>
        {leaveTypes.find((type) => type.id == request.leave_type)?.leave_type || "Unknown"}
      </td>
      <td>{new Date(request.start_date).toLocaleDateString()}</td>
      <td>{new Date(request.end_date).toLocaleDateString()}</td>
      <td>{request.reason}</td>
      <td>{request.status}</td>
      <td>
      {request.status === "Pending" ? (
                  <>
                    <Button variant="success" size="sm" onClick={() => handleApprove(request.id)}>
                      ✅
                    </Button>
                    {' '}
                    <Button variant="danger" size="sm" onClick={() => handleDelete(request.id)}>
                      ❌
                    </Button>
                  </>
                ) : (
                  <span>{request.status}</span> // Show the status if approved
                )}
      </td>
    </tr>
  ))}
</tbody>

      </table>

      
    </div>
    </div>
    </section>
  );
};

export default LeaveRequest;
