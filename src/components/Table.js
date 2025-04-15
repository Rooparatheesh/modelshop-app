import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import ViewEmployeeModal from './ViewEmployeeModal';
import EditEmployeeModal from './EditEmployeeModal';
import NewEmployeeModal from './NewEmployeeModal';
import Swal from "sweetalert2";

const Table = () => {
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isViewModalOpen, setViewModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isNewModalOpen, setNewModalOpen] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
 ;
 

 const handleUpdateEmployee = (updatedEmployee) => {
   setEmployees((prevEmployees) =>
     prevEmployees.map((emp) =>
       emp.employee_id === updatedEmployee.employee_id ? { ...emp, ...updatedEmployee } : emp
     )
   );
 };
  const handleAddEmployee = (newEmployee) => {
    setEmployees((prevEmployees) => [...prevEmployees, newEmployee]);
  };
  // Fetch employees
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/employees`)
      .then((response) => {
        setEmployees(response.data);
      })
      .catch((error) => {
        console.error('Error fetching employees:', error);
      })
      .finally(() => {
        setLoadingEmployees(false);
      });
  }, []);

  // Fetch permissions for current user
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const token = localStorage.getItem('jwt_token');
        if (!token) {
          console.error('No token found');
          return;
        }

        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/permissions/current_user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        setPermissions(response.data.permissions || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions([]);
      } finally {
        setLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, []);

  // Filter employees based on search query
  const filteredEmployees = employees.filter((employee) =>
    employee.employee_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleEntriesChange = (event) => {
    setEntriesPerPage(Number(event.target.value));
  };
 
  
  const exportToExcel = () => {
    // Extract only the displayed columns
    const exportData = filteredEmployees.slice(0, entriesPerPage).map(({ password, ...employee }) => employee);
  
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'employees.xlsx');
  };
  

  const handleViewEmployee = (employee) => {
    console.log('View employee:', employee); // Debug log
    setSelectedEmployee(employee);
    setViewModalOpen(true);
  };

  const handleEditEmployee = (employee) => {
    console.log('Edit employee:', employee); // Debug log
    setSelectedEmployee(employee);
    setEditModalOpen(true); // Open the edit modal
  };

  const confirmDeleteEmployee = (employeeId) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then((result) => {
      if (result.isConfirmed) {
        handleDeleteEmployee(employeeId);
      }
    });
  };
  
  const handleDeleteEmployee = async (employeeId) => {
    try {
      const token = localStorage.getItem("jwt_token");
      if (!token) {
        Swal.fire("Error!", "Unauthorized access. Please log in.", "error");
        return;
      }
  
      const response = await axios.delete(
        `${process.env.REACT_APP_API_URL}/api/employees/${employeeId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (response.data.success) {
        setEmployees((prevEmployees) =>
          prevEmployees.filter((e) => e.employee_id !== employeeId)
        );
        Swal.fire("Deleted!", "The employee has been removed.", "success");
      } else {
        Swal.fire("Error!", response.data.message || "Failed to delete employee.", "error");
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      Swal.fire("Error!", "Something went wrong. Please try again.", "error");
    }
  };
  // Ensure loading states are handled
  if (loadingPermissions || loadingEmployees) {
    return <div>Loading...</div>;
  }

  return (
    
    <section className="content">
      <div className="content-wrapper">
        <div className="card-body">
          <h1 className="text-start fw-bold nav-text">Employee List</h1>

          {/* Button Row */}
          <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
            {/* Check if 'create' permission exists */}
            {permissions.includes('create') && (
              <button className="btn btn-primary btn-lg" onClick={() => setNewModalOpen(true)}>
                New User <i className="bi bi-people-fill"></i>
              </button>
            )}

            <button className="btn btn-outline-success btn-lg" onClick={exportToExcel}>
              <i className="bi bi-filetype-xls"></i> Export to Excel
            </button>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <label htmlFor="entries" className="form-label">Show</label>
              <select id="entries" className="form-select form-select-sm w-auto d-inline" onChange={handleEntriesChange}>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
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

          {/* Table */}
          <div className="table-responsive">
            <table className="table table-bordered table-striped">
              <thead>
                <tr>
                  <th>SL.NO</th>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Designation</th>
                  <th>Email</th>
                  <th>Phone Number</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
              {filteredEmployees
  .sort((a, b) => a.employee_name.localeCompare(b.employee_name)) // Sort by name in ascending order
  .slice(0, entriesPerPage)
  .map((employee, index) => (
    <tr key={employee.employee_id}>
      <td>{index + 1}</td>
      <td>{employee.employee_id}</td>
      <td>{employee.employee_name}</td>
      <td>{employee.designation}</td>
      <td>{employee.email_id}</td>
      <td>{employee.phone_number}</td>
      <td>
                      {/* View Button */}
                      {permissions.includes('view') && (
                        <button
                          type="button"
                          className="btn btn-warning me-2"
                          onClick={() => handleViewEmployee(employee)}
                        >
                          View
                        </button>
                      )}

                      {/* Edit Button */}
                      {permissions.includes('update') && (
                        <button
                          type="button"
                          className="btn btn-info me-2"
                          onClick={() => handleEditEmployee(employee)}
                        >
                          Edit
                        </button>
                      )}

                     {permissions.includes('delete') && (
  <button
    type="button"
    className="btn btn-danger btn-sm"
    onClick={() => confirmDeleteEmployee(employee.employee_id)}
  >
    Delete
  </button>
)}

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isViewModalOpen && (
        <ViewEmployeeModal employee={selectedEmployee} onClose={() => setViewModalOpen(false)} />
      )}

      {isEditModalOpen && (
        <EditEmployeeModal employee={selectedEmployee} onClose={() => setEditModalOpen(false)} />
      )}

      {isNewModalOpen && (
  <NewEmployeeModal 
    onClose={() => setNewModalOpen(false)} 
    onAddEmployee={handleAddEmployee} 
  />
)}

    </section>
  );
};

export default Table;
