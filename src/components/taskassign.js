import React, { useState,useEffect } from "react";
import axios from "axios"; // Add this to fix 'axios is not defined'
import Swal from "sweetalert2";


function AssignTaskPage() {
  const [controlNumber, setControlNumber] = useState("");
  const [partNumbers, setPartNumbers] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [trades, setTrades] = useState([]);
  const [employees, setEmployees] = useState({});
  const [selectedEmployees, setSelectedEmployees] = useState({});
  const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
const [tasks, setTasks] = useState([]); // Define tasks state to store assigned tasks

 
// Fetch parts based on control number
const fetchParts = async (controlNum) => {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/parts/${controlNum}`);
    setPartNumbers(response.data);
  } catch (error) {
    console.error("Error fetching parts:", error);
    setPartNumbers([]);
  }
};
// Fetch trade names
useEffect(() => {
  axios.get(`${process.env.REACT_APP_API_URL}/api/trades`)
    .then(response => {
      setTrades(response.data);
      const initialSelectedEmployees = {};
      response.data.forEach(trade => {
        initialSelectedEmployees[trade.trade_id] = [];
      });
      setSelectedEmployees(initialSelectedEmployees);
    })
    .catch(error => console.error("Error fetching trades:", error));
}, []);

useEffect(() => {
  if (trades.length > 0) {
    const fetchEmployees = async () => {
      const employeesData = {};
      for (const trade of trades) {
        try {
          const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/employees/${trade.trade_id}`);
          employeesData[trade.trade_id] = response.data;
        } catch (error) {
          console.error(`Error fetching employees for trade ${trade.trade_id}:`, error);
          employeesData[trade.trade_id] = [];
        }
      }
      setEmployees({ ...employeesData }); // Force state update
    };

    fetchEmployees();
  }
}, [trades]);
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    setUploadedFile(file); // Correctly set the uploaded file in state
  } else {
    setUploadedFile(null); // Reset file state if no file is selected
  }
};

const handleSubmit = async () => {
  const loggedInEmployeeId = sessionStorage.getItem("employeeId"); // Get logged-in employee ID

  if (!loggedInEmployeeId) {
    Swal.fire({
      title: "Error!",
      text: "Logged-in Employee ID not found. Please log in again.",
      icon: "error",
      confirmButtonText: "OK",
    });
    return;
  }

  if (!uploadedFile) {
    Swal.fire({
      title: "No File Selected!",
      text: "Please select a file before submitting.",
      icon: "warning",
      confirmButtonText: "OK",
    });
    return;
  }

  if (!tasks.length) {
    Swal.fire({
      title: "No Tasks Added!",
      text: "Please add tasks before submitting.",
      icon: "warning",
      confirmButtonText: "OK",
    });
    return;
  }

  const formData = new FormData();
  formData.append("document", uploadedFile);
  formData.append("tasks", JSON.stringify(tasks));
  formData.append("assigned_by", loggedInEmployeeId); // ✅ Include the logged-in employee ID

  try {
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/assign_tasks`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Failed to assign tasks");
    }

    const data = await response.json();
    console.log("✅ Tasks assigned successfully:", data);

    Swal.fire({
      title: "Success!",
      text: "Tasks assigned successfully and notifications sent!",
      icon: "success",
      confirmButtonText: "OK",
    });

    // Clear input after successful submission
    setUploadedFile(null);
    setTasks([]);

  } catch (error) {
    console.error("❌ Error assigning tasks:", error);

    Swal.fire({
      title: "Error!",
      text: "Failed to assign tasks. Please try again.",
      icon: "error",
      confirmButtonText: "OK",
    });
  }
};





const handleEmployeeSelection = (tradeId, employee) => {
  setSelectedEmployees(prevState => {
    const selected = prevState[tradeId] || [];
    if (selected.some(emp => emp.employee_id === employee.employee_id)) {
      return {
        ...prevState,
        [tradeId]: selected.filter(emp => emp.employee_id !== employee.employee_id)
      };
    } else {
      return {
        ...prevState,
        [tradeId]: [...selected, employee]
      };
    }
  });
};


const handleControlNumberChange = (e) => {
  const value = e.target.value;
  setControlNumber(value);
  if (value) {
    fetchParts(value);
  } else {
    setPartNumbers([]);
  }
};
const handleAssignTask = async () => {
  const loggedInEmployeeId = sessionStorage.getItem("employeeId");

  if (!loggedInEmployeeId) {
    alert("Error: Logged-in Employee ID not found. Please log in again.");
    return;
  }

  if (
    !controlNumber ||
    selectedParts.length === 0 ||
    Object.values(selectedEmployees).every(emp => emp.length === 0) ||
    !startDate ||
    !endDate ||
    !uploadedFile
  ) {
    alert("Please fill all fields before assigning a task.");
    return;
  }

  const newTask = {
    controlNumber,
    parts: selectedParts,
    employees: Object.values(selectedEmployees).flat(),
    startDate,
    endDate,
    uploadedFile, // ✅ Save the actual file object for later use
    doc_upload_path: uploadedFile.name, // Optional: you can use this to show the file name
    assigned_by: loggedInEmployeeId,
  };

  setTasks(prevTasks => [...prevTasks, newTask]);

  // Clear form fields after assigning, but DO NOT clear uploadedFile
  setControlNumber("");
  setPartNumbers([]);
  setSelectedParts([]);
  setSelectedEmployees({});
  setStartDate("");
  setEndDate("");
  // ⚠️ Don't clear uploadedFile if you're using it in handleSubmit
  // setUploadedFile(null);
};


  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-GB"); // Converts YYYY-MM-DD to DD-MM-YYYY
  };


  const handleDeleteTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };
  const handleEditTask = (index) => {
    const taskToEdit = tasks[index];
  
    setControlNumber(taskToEdit.controlNumber);
    setSelectedParts(taskToEdit.parts);
    setSelectedEmployees(taskToEdit.employees.reduce((acc, emp) => {
      const tradeId = trades.find(trade => employees[trade.trade_id]?.some(e => e.employee_id === emp.employee_id))?.trade_id;
      if (tradeId) {
        acc[tradeId] = acc[tradeId] ? [...acc[tradeId], emp] : [emp];
      }
      return acc;
    }, {}));
    setStartDate(taskToEdit.startDate);
    setEndDate(taskToEdit.endDate);
    
   
  };
  
  
  
  // Employee category colors
  const categoryColors = {
    1: "#0275d8", // Yellow
    2:"#049a8f",
    3: "#5cb85c", 
    4: "#5bc0de", 
    5: "#f0ad4e", 
    6: "#ecb176",

  };

  return (
    <section className="content">
    <div className="content-wrapper">
      <div className="container mt-4 d-flex gap-4">
          {/* Left Side - Task Assignment Form */}
          <div className="card p-3 col-12 col-md-5">

            <h4 className="mb-3">Assign Task</h4>

            {/* Control Number */}
            <label>Control Number <span className="text-danger">*</span></label>
            <input
  type="text"
  value={controlNumber}
  onChange={(e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      handleControlNumberChange(e);
    }
  }}
  className="form-control mb-2"
/>
            {/* Part Numbers */}
            <div className="mb-2">
              <label>Part Numbers<span className="text-danger">*</span></label>
              <div className="d-flex flex-wrap">
                {partNumbers.map((part, index) => (
                  <div key={index} className="form-check w-50">
                    <input
                      type="checkbox"
                      id={`part-${index}`}
                      className="form-check-input"
                      checked={selectedParts.includes(part)}
                      onChange={() =>
                        setSelectedParts((prev) =>
                          prev.includes(part) ? prev.filter((p) => p !== part) : [...prev, part]
                        )
                      }
                    />
                    <label className="form-check-label" htmlFor={`part-${index}`}>{part}</label>
                  </div>
                ))}
              </div>
            
            </div>

           {/* Employees Selection (Accordion) */}
        <label>Assign Employees <span className="text-danger">*</span></label>
        <div className="accordion" id="tradeAccordion">
        {trades.map((trade, index) => (
            <div className="accordion-item" key={trade.trade_id}>
              <h2 className="accordion-header" id={`heading-${trade.trade_id}`}>
                <button
                  className="accordion-button"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target={`#collapse-${trade.trade_id}`}
                  aria-expanded="true"
                  aria-controls={`collapse-${trade.trade_id}`}
                  style={{ backgroundColor: categoryColors[trade.trade_id]|| "#000", color: "white" }}
                >
                  {trade.trade_name.charAt(0).toUpperCase() + trade.trade_name.slice(1)}
                </button>
              </h2>
              <div
                id={`collapse-${trade.trade_id}`}
                className="accordion-collapse collapse"
                aria-labelledby={`heading-${trade.trade_id}`}
                data-bs-parent="#employeeAccordion"
              >
                <div className="accordion-body">
                  <div className="row">
                  {(employees[trade.trade_id] || []).map((employee, index) => (
  <div key={employee.employee_id} className="col-6 mb-2">
    <div className="form-check">
      <input
        type="checkbox"
        id={`emp-${employee.employee_id}`}
        className="form-check-input"
        checked={selectedEmployees[trade.trade_id]?.includes(employee)}
        onChange={() => handleEmployeeSelection(trade.trade_id, employee)}
      />
      <label className="form-check-label" htmlFor={`emp-${employee.employee_id}`}>
        {employee.employee_name}
      </label>
    </div>
  </div>
)) || <p>No employees available.</p>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Start & End Date */}
<label>Start & End Date <span className="text-danger">*</span></label>
<div className="d-flex gap-2">
  <input
    type="date"
    value={startDate}
    onChange={(e) => {
      setStartDate(e.target.value);
      // Ensure the end date is not earlier than the start date
      if (endDate && e.target.value > endDate) {
        setEndDate(e.target.value);
      }
    }}
    className="form-control"
  />
  <input
    type="date"
    value={endDate}
    onChange={(e) => setEndDate(e.target.value)}
    min={startDate} // Prevent selecting an earlier end date
    className="form-control"
  />
</div>

<label>
  Upload Document <span className="text-danger">*</span>
</label>
<input
  type="file"
  accept=".pdf,.doc,.docx"
  key={uploadedFile ? uploadedFile.name : "file-input"} // Prevents input from clearing unexpectedly
  onChange={handleFileChange}
/>

{uploadedFile && (
  <div className="mt-2">
    <strong>Uploaded Document:</strong> {uploadedFile.name}
  </div>
)}
    
  

        {/* Assign Button */}
        <button className="btn btn-success mt-3" onClick={handleAssignTask}>
          Assign Task
        </button>
      </div>
{/* Right Side - Task List in Three Columns */}
<div className="ms-auto" style={{ width: "55%" }}> {/* Moves div to the right */}

  <div className="row g-"> {/* Bootstrap grid system for three columns */}
    {tasks.map((task, index) => (
      <div key={index} className="col-md-4"> {/* Three columns per row */}
        <div className="card p-3 h-100" style={{ minHeight: "250px" }}> {/* Fixed height */}
          <div>
            <strong>Control Number:</strong> {task.controlNumber} <br />
            <strong>Parts:</strong> {task.parts.join(", ")} <br />
            
            {/* Employees Display with Spacing */}
            <strong>Employees:</strong>
            <div className="d-flex flex-wrap mt-1">
              {task.employees.map((employee, i) => {
                const category = Object.keys(employees).find(category => employees[category].includes(employee));
                return (
                  <span key={i} style={{ 
                    backgroundColor: categoryColors[category], 
                    color: "white", 
                    padding: "4px 8px", 
                    borderRadius: "4px", 
                    margin: "2px 4px"  // Added margin for spacing
                  }}>
                    {employee.employee_name}
                  </span>
                );
              })}
            </div>
         



            {/* Start & End Date */}
            <div className="mt-2">
              <strong>Start - End Date:</strong> {formatDate(task.startDate)} → {formatDate(task.endDate)}
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-2">
            <button className="btn btn-warning me-2" style={{ color: "white" }} onClick={() => handleEditTask(index)}>
              Edit
            </button>
            <button className="btn btn-danger" onClick={() => handleDeleteTask(index)}>
              Delete
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>

  {/* Submit Button */}
{tasks.length > 0 && (
  <button className="btn btn-primary mt-3 float-end" onClick={handleSubmit}>
    Submit
  </button>
)}
</div>
    </div>
  </div>
</section>
  );
}

export default AssignTaskPage;