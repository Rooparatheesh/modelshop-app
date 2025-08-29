import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { FaFilePdf } from 'react-icons/fa';

const ReportGeneration = () => {
  const [searchId, setSearchId] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [employeeData, setEmployeeData] = useState(null);
  const [idExists, setIdExists] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [controlNumber, setControlNumber] = useState('');
  const [controlNumberData, setControlNumberData] = useState(null);
  const [controlReportContent, setControlReportContent] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const suggestionRef = useRef(null);

  // Fetch all employees on component mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/employees`, { timeout: 5000 });
        if (Array.isArray(response.data)) {
          setAllEmployees(response.data);
        } else {
          console.error('Invalid employee data format:', response.data);
          setAllEmployees([]);
        }
      } catch (error) {
        console.error('Error fetching employee list:', error);
        setAllEmployees([]);
      }
    };
    fetchEmployees();
  }, []);

  // Handle input change and filter suggestions
  const handleSearchIdChange = (e) => {
    const value = e.target.value;
    setSearchId(value);
    if (!value.trim()) {
      setEmployeeData(null);
      setSelectedEmployee('');
      setIdExists(null);
      setSuggestions([]);
      setShowSuggestions(false);
    } else {
      const filteredSuggestions = allEmployees.filter(
        (employee) =>
          employee.employee_name.toLowerCase().includes(value.toLowerCase()) ||
          employee.employee_id.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
      setShowSuggestions(true);
    }
  };

  // Handle suggestion selection
  const handleSuggestionClick = (employee) => {
    setSearchId(employee.employee_name);
    setSelectedEmployee(employee.employee_id);
    setShowSuggestions(false);
    fetchEmployeeData(employee.employee_id);
  };

  // Handle clicks outside suggestion dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date)) return 'N/A';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Reset control number data
  const handleControlNumberChange = (e) => {
    const value = e.target.value;
    setControlNumber(value);
    if (!value.trim()) {
      setControlNumberData(null);
      setControlReportContent(null);
    }
  };

  const fetchEmployeeData = async (employeeId) => {
    if (!employeeId) {
      setEmployeeData(null);
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/employee-report/${employeeId}`);
      if (response.data.success) {
        setEmployeeData(response.data);
        setIdExists(true);
      } else {
        Swal.fire('Error!', response.data.message, 'error');
        setEmployeeData(null);
        setIdExists(false);
      }
    } catch (error) {
      console.error('Error fetching employee data:', error.response, error.request, error.message);
      Swal.fire('Error!', 'Error fetching employee data', 'error');
      setEmployeeData(null);
      setIdExists(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkControlNumber = async () => {
    if (!controlNumber.trim()) {
      Swal.fire('Warning', 'Please enter a control number to check.', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const existsResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/control-number-exists/${encodeURIComponent(controlNumber)}`,
        { timeout: 5000 }
      );

      if (existsResponse.data.exists) {
        const workOrder = existsResponse.data.data || existsResponse.data.workOrder || existsResponse.data;
        if (!workOrder || !workOrder.control_number) {
          throw new Error('Work order data is null or invalid');
        }
        setControlNumberData(workOrder);

        const reportResponse = await axios.get(
          `${process.env.REACT_APP_API_URL}/api/control-number-report-data/${encodeURIComponent(controlNumber)}`,
          { timeout: 6000 }
        );

        if (reportResponse.status === 200 && reportResponse.data.success) {
          setControlReportContent(reportResponse.data);
          Swal.fire('Success', 'Control number found', 'success');
        } else {
          throw new Error(reportResponse.data.message || 'Failed to fetch report content');
        }
      } else {
        setControlNumberData(null);
        setControlReportContent(null);
        Swal.fire('Not Found', 'No work order found with that control number.', 'error');
      }
    } catch (error) {
      console.error('Error checking control number:', error);
      let errorMessage = 'Error checking control number';
      if (error.response) {
        errorMessage = error.response.data.message || `Server error: ${error.response.status}`;
        if (error.response.status === 404) {
          errorMessage = 'Control number not found. Please verify the control number.';
        }
      } else if (error.request) {
        errorMessage = 'Network error: Unable to reach the server.';
      } else {
        errorMessage = error.message;
      }
      setControlNumberData(null);
      setControlReportContent(null);
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadControlNumberReport = async (controlNumber, format = 'pdf') => {
    if (!controlNumber) {
      Swal.fire('Error!', 'No control number selected', 'error');
      return;
    }
    if (!['pdf', 'excel'].includes(format)) {
      Swal.fire('Error!', 'Invalid format. Use "pdf" or "excel".', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/control-number-report/${encodeURIComponent(controlNumber)}/${format}`,
        { responseType: 'blob', timeout: 6000 }
      );

      if (response.status === 200) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `control_number_${controlNumber}_report.${format}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        Swal.fire('Success', `Downloading ${format.toUpperCase()} report`, 'success');
      }
    } catch (error) {
      console.error(`Error downloading ${format} report:`, error);
      let errorMessage = 'Error downloading report';
      if (error.response) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          errorMessage = json.message || `Server error: ${error.response.status}`;
        } catch (e) {
          errorMessage = `Server error: ${error.response.status}`;
        }
        if (error.response.status === 404) {
          errorMessage = 'Control number not found.';
        }
      } else if (error.request) {
        errorMessage = 'Network error: Unable to download the report.';
      } else {
        errorMessage = error.message;
      }
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const checkEmployeeId = () => {
    if (!searchId.trim()) {
      Swal.fire('Error', 'Please enter an employee ID or name to check.', 'warning');
      return;
    }

    if (selectedEmployee) {
      fetchEmployeeData(selectedEmployee);
    } else {
      Swal.fire('Error', 'Please select an employee from the suggestions.', 'warning');
    }
  };

  const downloadReport = async (format) => {
    if (!selectedEmployee) {
      Swal.fire('Error', 'Please select an employee', 'error');
      return;
    }
    if (!['pdf', 'excel'].includes(format)) {
      Swal.fire('Error!', 'Invalid format. Use "pdf" or "excel".', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/employee-report/${selectedEmployee}/${format}`,
        { responseType: 'blob', timeout: 6000 }
      );
      if (response.status === 200) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `employee_report_${selectedEmployee}.${format}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        Swal.fire('Success', `Downloading ${format.toUpperCase()} report`, 'success');
      }
    } catch (error) {
      console.error(`Error downloading ${format} report:`, error);
      let errorMessage = 'Error downloading report';
      if (error.response) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          errorMessage = json.message || `Server error: ${error.response.status}`;
        } catch (e) {
          errorMessage = `Server error: ${error.response.status}`;
        }
        if (error.response.status === 404) {
          errorMessage = 'Employee report not found.';
        }
      } else if (error.request) {
        errorMessage = 'Network error: Unable to download the report.';
      } else {
        errorMessage = error.message;
      }
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="content">
      <div className="content-wrapper" style={{ padding: '20px' }}>
        <div
          style={{
            maxWidth: '1600px',
            margin: '0 auto',
            background: '#f8f9fa',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ padding: '20px' }}>
            <h2 style={{ marginBottom: '20px', color: '#293b5f' }}>
              Report Generator
            </h2>

            {/* Search by Employee ID or Name */}
            <div style={{ marginBottom: '20px', position: 'relative' }}>
              <label style={{ fontWeight: '500' }}>Check by Employee ID or Name:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={searchId}
                  onChange={handleSearchIdChange}
                  placeholder="Enter employee ID or name"
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    width: '250px',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    backgroundColor: isLoading ? '#e9ecef' : 'white',
                  }}
                />
                <button
                  onClick={checkEmployeeId}
                  disabled={isLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: isLoading ? '#6c757d' : '#293b5f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Checking...' : 'Check'}
                </button>
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <ul
                  ref={suggestionRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxWidth: '250px',
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    listStyle: 'none',
                    padding: 0,
                    margin: '5px 0 0 0',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                  }}
                >
                  {suggestions.map((employee) => (
                    <li
                      key={employee.employee_id}
                      onClick={() => handleSuggestionClick(employee)}
                      style={{
                        padding: '10px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        backgroundColor: '#fff',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => (e.target.style.backgroundColor = '#f0f0f0')}
                      onMouseLeave={(e) => (e.target.style.backgroundColor = '#fff')}
                    >
                      {employee.employee_name} ({employee.employee_id})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Search by Control Number */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: '500' }}>Check by Control Number:</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={controlNumber}
                  onChange={handleControlNumberChange}
                  placeholder="Enter control number"
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    width: '250px',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    backgroundColor: isLoading ? '#e9ecef' : 'white',
                  }}
                />
                <button
                  onClick={checkControlNumber}
                  disabled={isLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: isLoading ? '#6c757d' : '#293b5f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? 'Checking...' : 'Check'}
                </button>
              </div>
            </div>

            {controlReportContent && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '5px', color: '#293b5f' }}>
                  Control Number Report
                </h4>
                <div style={{
                  backgroundColor: '#fff',
                  padding: '20px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  marginBottom: '10px',
                }}>
                  <h5 style={{ margin: '20px 0 10px', color: '#333' }}>
                    Work Order Details
                  </h5>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    marginBottom: '20px',
                  }}>
                    <tbody>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Control Number
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.controlNumber || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Work Order Number
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.workOrderNumber || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Project Code
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.projectCode || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Group Section
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.groupSection || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Priority
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.priority || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Product Description
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.productDescription || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Work Order Date
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.workOrderDate || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Desired Completion Date
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.desiredCompletionDate || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Total Man Days
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.totalManDays || 'N/A'}
                        </td>
                      </tr>
                      <tr>
                        <th style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: '#e9ecef',
                          fontWeight: 'bold',
                        }}>
                          Delay Status
                        </th>
                        <td style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          backgroundColor: 'white',
                        }}>
                          {controlReportContent.workOrder.delayedOnTime || 'N/A'}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <h5 style={{ margin: '20px 0 10px', color: '#333' }}>
                    Part and Employee Details
                  </h5>
                  {controlReportContent.groups.length === 0 ? (
                    <p style={{ margin: '10px 0', color: '#333' }}>
                      No parts or employee groups found.
                    </p>
                  ) : (
                    controlReportContent.groups.map((group, index) => (
                      <div key={group.assignment_id} style={{ marginBottom: '20px' }}>
                        <h6 style={{ margin: '15px 0 5px', color: '#293b5f' }}>
                          Part {index + 1}
                        </h6>
                        <table style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          marginBottom: '10px',
                        }}>
                          <thead>
                            <tr>
                              <th style={{
                                border: '1px solid #ccc',
                                padding: '8px',
                                textAlign: 'left',
                                backgroundColor: '#e9ecef',
                                fontWeight: 'bold',
                              }}>
                                Part Number
                              </th>
                              <th style={{
                                border: '1px solid #ccc',
                                padding: '8px',
                                textAlign: 'left',
                                backgroundColor: '#e9ecef',
                                fontWeight: 'bold',
                              }}>
                                Description
                              </th>
                              <th style={{
                                border: '1px solid #ccc',
                                padding: '8px',
                                textAlign: 'left',
                                backgroundColor: '#e9ecef',
                                fontWeight: 'bold',
                              }}>
                                Quantity
                              </th>
                              <th style={{
                                border: '1px solid #ccc',
                                padding: '8px',
                                textAlign: 'left',
                                backgroundColor: '#e9ecef',
                                fontWeight: 'bold',
                              }}>
                                Finished Date
                              </th>
                              <th style={{
                                border: '1px solid #ccc',
                                padding: '8px',
                                textAlign: 'left',
                                backgroundColor: '#e9ecef',
                                fontWeight: 'bold',
                              }}>
                                Employee Names
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.parts.length === 0 ? (
                              <tr>
                                <td colSpan="5" style={{
                                  border: '1px solid #ccc',
                                  padding: '8px',
                                  backgroundColor: 'white',
                                  textAlign: 'center',
                                }}>
                                  No parts found.
                                </td>
                              </tr>
                            ) : (
                              group.parts.map((part, partIndex) => (
                                <tr key={partIndex}>
                                  <td style={{
                                    border: '1px solid #ccc',
                                    padding: '8px',
                                    backgroundColor: 'white',
                                  }}>
                                    {part.partNumber || 'N/A'}
                                  </td>
                                  <td style={{
                                    border: '1px solid #ccc',
                                    padding: '8px',
                                    backgroundColor: 'white',
                                  }}>
                                    {part.description || 'N/A'}
                                  </td>
                                  <td style={{
                                    border: '1px solid #ccc',
                                    padding: '8px',
                                    backgroundColor: 'white',
                                  }}>
                                    {part.quantity || 'N/A'}
                                  </td>
                                  <td style={{
                                    border: '1px solid #ccc',
                                    padding: '8px',
                                    backgroundColor: 'white',
                                  }}>
                                    {part.finishedDate || 'N/A'}
                                  </td>
                                  <td style={{
                                    border: '1px solid #ccc',
                                    padding: '8px',
                                    backgroundColor: 'white',
                                  }}>
                                    {partIndex === 0 ? (group.employeeNames || 'N/A') : ''}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}

                  {/* Download Buttons */}
                  <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => downloadControlNumberReport(controlNumberData.control_number, 'pdf')}
                      disabled={isLoading || !controlNumberData?.control_number}
                      style={{
                        backgroundColor: isLoading || !controlNumberData?.control_number ? '#6c757d' : '#293b5f',
                        color: '#fff',
                        padding: '10px 20px',
                        fontSize: '16px',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: isLoading || !controlNumberData?.control_number ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <FaFilePdf /> Download PDF Report
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Employee Details */}
            {employeeData && (
              <div style={{ marginTop: '20px' }}>
                <h4 style={{ marginBottom: '8px', color: '#333' }}>Employee Details:</h4>
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ margin: '5px 0' }}><strong>Employee ID:</strong> {employeeData.employee.employee_id}</p>
                  <p style={{ margin: '5px 0' }}><strong>Name:</strong> {employeeData.employee.employee_name}</p>
                  <p style={{ margin: '5px 0' }}><strong>Designation:</strong> {employeeData.employee.designation}</p>
                  <p style={{ margin: '5px 0' }}><strong>Email:</strong> {employeeData.employee.email_id}</p>
                </div>

                <h4 style={{ marginBottom: '8px', color: '#333' }}>Assigned Tasks:</h4>
                {employeeData.tasks.length === 0 ? (
                  <p style={{ margin: '10px 0', color: '#333' }}>No tasks assigned.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        border: '1px solid #ccc',
                        marginBottom: '20px',
                        tableLayout: 'auto',
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: '#e9ecef' }}>
                          <th style={{ ...thStyle, minWidth: '100px' }}>Control Number</th>
                          <th style={{ ...thStyle, minWidth: '80px' }}>Status</th>
                          <th style={{ ...thStyle, minWidth: '120px' }}>Part Number(s)</th>
                          <th style={{ ...thStyle, minWidth: '150px', maxWidth: '200px' }}>
                            Part Descriptions
                          </th>
                          <th style={{ ...thStyle, minWidth: '100px' }}>Actual Start Date</th>
                          <th style={{ ...thStyle, minWidth: '100px' }}>Actual End Date</th>
                          <th style={{ ...thStyle, minWidth: '80px' }}>Total Working Days</th>
                          <th style={{ ...thStyle, minWidth: '100px' }}>Group Section</th>
                          <th style={{ ...thStyle, minWidth: '80px' }}>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeData.tasks.map((task) => (
                          <tr key={task.id}>
                            <td style={{ ...tdStyle, wordBreak: 'break-word' }}>{task.control_number}</td>
                            <td style={{ ...tdStyle, wordBreak: 'break-word' }}>{task.status}</td>
                            <td style={{ ...tdStyle, wordBreak: 'break-word' }}>
                              {Array.isArray(task.part_number)
                                ? task.part_number.join(', ')
                                : task.part_number || 'N/A'}
                            </td>
                            <td style={{ ...tdStyle, wordBreak: 'break-word', maxWidth: '200px' }}>
                              {task.part_descriptions}
                            </td>
                            <td style={{ ...tdStyle, wordBreak: 'break-word' }}>
                              {formatDate(task.actual_start_date)}
                            </td>
                            <td style={{ ...tdStyle, wordBreak: 'break-word' }}>
                              {formatDate(task.actual_end_date)}
                            </td>
                            <td style={{ ...tdStyle, wordBreak: 'break-word' }}>
                              {task.total_working_days || 'N/A'}
                            </td>
                            <td style={{ ...tdStyle, wordBreak: 'break-word' }}>{task.group_section || 'N/A'}</td>
                            <td style={{ ...tdStyle, wordBreak: 'break-word' }}>{task.priority || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => downloadReport('pdf')}
                    disabled={!selectedEmployee || isLoading}
                    style={{
                      backgroundColor: selectedEmployee && !isLoading ? '#293b5f' : '#6c757d',
                      color: '#fff',
                      padding: '10px 20px',
                      fontSize: '16px',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: selectedEmployee && !isLoading ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <FaFilePdf /> Download PDF Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

const thStyle = {
  border: '1px solid #ccc',
  padding: '8px',
  textAlign: 'left',
};

const tdStyle = {
  border: '1px solid #ccc',
  padding: '8px',
};

export default ReportGeneration;