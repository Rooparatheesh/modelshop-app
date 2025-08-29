import React, { useState, useEffect } from "react";
import axios from "axios";
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
  const [tasks, setTasks] = useState([]);
  const [qcRequired, setQcRequired] = useState("no");
  const [qcEmployees, setQcEmployees] = useState([]);
  const [selectedQcEmployees, setSelectedQcEmployees] = useState([]);

  // Fetch QC employees when qcRequired is "yes"
  useEffect(() => {
    if (qcRequired === "yes") {
      fetch(`${process.env.REACT_APP_API_URL}/api/qc-employees`)
        .then((res) => res.json())
        .then((data) => {
          const normalizedData = data.map((emp) => ({
            employee_id: String(emp.employee_id).trim(),
            employee_name: emp.employee_name ? emp.employee_name.trim() : "Unknown",
          }));
          console.log("QC employees fetched:", JSON.stringify(normalizedData, null, 2));
          setQcEmployees(normalizedData);
        })
        .catch((err) => {
          console.error("Error fetching QC employees:", err.message);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "Failed to fetch QC employees",
          });
        });
    } else {
      setQcEmployees([]);
      setSelectedQcEmployees([]);
    }
  }, [qcRequired]);

  // Fetch parts
  const fetchParts = async (controlNum) => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/parts/${controlNum}`);
      console.log("Fetched parts:", response.data);
      setPartNumbers(response.data);
    } catch (error) {
      console.error("Error fetching parts:", error.message);
      setPartNumbers([]);
      // Swal.fire({
      //   icon: "error",
      //   title: "Error",
      //   text: "Failed to fetch parts",
      // });
    }
  };

  // Fetch trades
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/trades`)
      .then((response) => {
        console.log("Fetched trades:", response.data);
        setTrades(response.data);
        const initialSelectedEmployees = {};
        response.data.forEach((trade) => {
          initialSelectedEmployees[trade.trade_id] = [];
        });
        setSelectedEmployees(initialSelectedEmployees);
      })
      .catch((error) => {
        console.error("Error fetching trades:", error.message);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to fetch trades",
        });
      });
  }, []);

  // Fetch employees
  useEffect(() => {
    if (trades.length > 0) {
      const fetchEmployees = async () => {
        const employeesData = {};
        for (const trade of trades) {
          try {
            const response = await axios.get(
              `${process.env.REACT_APP_API_URL}/api/employees/${trade.trade_id}`
            );
            const normalizedEmployees = response.data.map((emp) => ({
              ...emp,
              employee_id: String(emp.employee_id).trim(),
              employee_name: emp.employee_name ? emp.employee_name.trim() : "Unknown",
            }));
            employeesData[trade.trade_id] = normalizedEmployees;
            console.log(
              `Employees for trade ${trade.trade_id}:`,
              normalizedEmployees.map((e) => ({
                employee_id: e.employee_id,
                employee_name: e.employee_name,
              }))
            );
            const str192 = normalizedEmployees.find(
              (emp) => emp.employee_id === "STR-192" || emp.employee_name.toUpperCase() === "AJITHKUMAR K"
            );
            if (str192) {
              console.log(`STR-192 found in trade ${trade.trade_id}:`, str192);
            } else if (trade.trade_id === 3) {
              console.warn(`STR-192 (AJITHKUMAR K) not found in trade 3 employees`);
            }
          } catch (error) {
            console.error(`Error fetching employees for trade ${trade.trade_id}:`, error.message);
            employeesData[trade.trade_id] = [];
          }
        }
        setEmployees({ ...employeesData });
      };
      fetchEmployees();
    }
  }, [trades]);

  // Handle file change
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log("Selected file:", file.name);
      setUploadedFile(file);
    } else {
      setUploadedFile(null);
    }
  };

  // Handle QC employee selection
  const handleQcChange = (employeeId, checked) => {
    console.log(`QC employee ${employeeId} ${checked ? "selected" : "deselected"}`);
    setSelectedQcEmployees((prev) =>
      checked ? [...prev, employeeId] : prev.filter((id) => id !== employeeId)
    );
  };

  // Handle employee selection
  const handleEmployeeSelection = (tradeId, employee) => {
    console.log(`Selecting employee: ${employee.employee_id} (${employee.employee_name}) for trade: ${tradeId}`);
    setSelectedEmployees((prevState) => {
      const selected = prevState[tradeId] || [];
      const isSelected = selected.some((emp) => emp.employee_id === employee.employee_id);
      let updated;
      if (isSelected) {
        updated = selected.filter((emp) => emp.employee_id !== employee.employee_id);
        console.log(`Deselected employee: ${employee.employee_id} (${employee.employee_name})`, updated);
      } else {
        updated = [...selected, { ...employee, employee_id: String(employee.employee_id).trim() }];
        console.log(`Selected employee: ${employee.employee_id} (${employee.employee_name})`, updated);
      }
      return {
        ...prevState,
        [tradeId]: updated,
      };
    });
  };

  // Handle task assignment
  const handleAssignTask = async () => {
    const loggedInEmployeeId = sessionStorage.getItem("employeeId");
    if (!loggedInEmployeeId) {
      Swal.fire({
        icon: "error",
        title: "Session Expired",
        text: "Logged-in Employee ID not found. Please log in again.",
      });
      return;
    }

    if (
      !controlNumber ||
      selectedParts.length === 0 ||
      Object.values(selectedEmployees).every((emp) => emp.length === 0) ||
      !startDate ||
      !endDate ||
      !uploadedFile ||
      (qcRequired === "yes" && selectedQcEmployees.length === 0)
    ) {
      Swal.fire({
        icon: "warning",
        title: "Incomplete Form",
        text: "Please fill all required fields before assigning a task.",
      });
      return;
    }

    console.log("Selected QC employees:", selectedQcEmployees);
    console.log("Available QC employees:", JSON.stringify(qcEmployees, null, 2));

    const newTask = {
      controlNumber,
      parts: selectedParts,
      employees: Object.values(selectedEmployees)
        .flat()
        .map((emp) => ({
          employee_id: String(emp.employee_id).trim(),
          employee_name: emp.employee_name ? emp.employee_name.trim() : "Unknown",
        })),
      startDate,
      endDate,
      uploadedFile,
      doc_upload_path: uploadedFile.name,
      assigned_by: loggedInEmployeeId,
      qcRequired,
      qcEmployees: selectedQcEmployees
        .map((employeeId) => {
          const emp = qcEmployees.find((e) => e.employee_id === employeeId);
          if (!emp) {
            console.warn(`QC employee not found for ID: ${employeeId}`);
            return null;
          }
          return {
            employee_id: String(emp.employee_id).trim(),
            employee_name: emp.employee_name ? emp.employee_name.trim() : "Unknown",
          };
        })
        .filter((emp) => emp !== null),
    };

    console.log("New task:", JSON.stringify(newTask, null, 2));

    if (!newTask.employees.some((emp) => emp.employee_id === "STR-192")) {
      Swal.fire({
        icon: "info",
        title: "Note",
        text: "STR-192 (AJITHKUMAR K) is not included in this task.",
      });
    }

    setTasks((prevTasks) => [...prevTasks, newTask]);
    setControlNumber("");
    setPartNumbers([]);
    setSelectedParts([]);
    setSelectedEmployees(Object.fromEntries(Object.keys(selectedEmployees).map((key) => [key, []])));
    setStartDate("");
    setEndDate("");
    setQcRequired("no");
    setSelectedQcEmployees([]);

    Swal.fire({
      icon: "success",
      title: "Task Assigned",
      text: `Task successfully assigned for control number ${newTask.controlNumber}.`,
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e?.preventDefault();

    const loggedInEmployeeId = sessionStorage.getItem("employeeId");
    if (!loggedInEmployeeId) {
      return Swal.fire({ title: "Error!", text: "Please log in again.", icon: "error" });
    }
    if (!uploadedFile) {
      return Swal.fire({ title: "No File Selected!", text: "Please select a file.", icon: "warning" });
    }
    if (!tasks.length) {
      return Swal.fire({ title: "No Tasks Added!", text: "Please add tasks.", icon: "warning" });
    }

    const formData = new FormData();
    formData.append("document", uploadedFile);
    formData.append(
      "tasks",
      JSON.stringify(
        tasks.map((task) => ({
          ...task,
          employees: task.employees.map((emp) => ({
            employee_id: String(emp.employee_id).trim(),
            employee_name: emp.employee_name?.trim() || "Unknown",
          })),
          qcEmployees: task.qcEmployees
            ? task.qcEmployees.map((emp) => ({
                employee_id: String(emp.employee_id).trim(),
                employee_name: emp.employee_name?.trim() || "Unknown",
              }))
            : [],
        }))
      )
    );
    formData.append("assigned_by", loggedInEmployeeId);
    console.log("FormData tasks:", JSON.stringify(JSON.parse(formData.get("tasks")), null, 2));

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/assign_tasks`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log("API response:", JSON.stringify(data, null, 2));

      if (!res.ok) {
        throw new Error(data.message || "Failed to assign tasks");
      }

      const assignments = data.assignments || [];
      if (!assignments || assignments.length === 0) {
        throw new Error("No valid assignments returned by server");
      }

      Swal.fire({
        title: "Success!",
        text: "Tasks assigned and notifications sent (including QC assignments)!",
        icon: "success",
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false,
      });

      setUploadedFile(null);
      setTasks([]);
    } catch (err) {
      console.error("❌ handleSubmit caught error:", err.message, err.stack);
      Swal.fire({
        title: "Error!",
        text: `Failed to assign tasks: ${err.message}`,
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };

  // Control number change
  const handleControlNumberChange = async (e) => {
    const value = e.target.value;
    if (!/^\d*$/.test(value)) return;
    setControlNumber(value);
    if (!value) {
      setPartNumbers([]);
      return;
    }
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/control-status/${value}`);
      const data = await res.json();
      if (data.status === "finished") {
        setControlNumber("");
        setPartNumbers([]);
        return Swal.fire("Already Finished", "This control number is already marked as finished.", "warning");
      }
      fetchParts(value);
    } catch (err) {
      console.error("Error checking control number:", err.message);
      Swal.fire("Error", "Failed to check control number status", "error");
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-GB");
  };

  const handleDeleteTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const handleEditTask = (index) => {
    const taskToEdit = tasks[index];
    setControlNumber(taskToEdit.controlNumber);
    setSelectedParts(taskToEdit.parts);
    setSelectedEmployees(
      taskToEdit.employees.reduce((acc, emp) => {
        const tradeId = trades.find((trade) =>
          employees[trade.trade_id]?.some((e) => e.employee_id === emp.employee_id)
        )?.trade_id;
        if (tradeId) {
          acc[tradeId] = acc[tradeId] ? [...acc[tradeId], emp] : [emp];
        }
        return acc;
      }, {})
    );
    setStartDate(taskToEdit.startDate);
    setEndDate(taskToEdit.endDate);
    setQcRequired(taskToEdit.qcRequired || "no");
    setSelectedQcEmployees(taskToEdit.qcEmployees ? taskToEdit.qcEmployees.map((emp) => emp.employee_id) : []);
  };

  return (
    <section className="content">
      <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet" />
      <div
        className="content-wrapper"
        style={{
          padding: "16px",
          backgroundColor: "#fafbfc",
          minHeight: "100vh",
          backgroundImage:
            "radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.05) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.05) 0%, transparent 50%)",
        }}
      >
        <div className="container-fluid">
          <div className="row g-3">
            <div className="col-12 col-lg-5">
              <div
                className="card border-0"
                style={{
                  borderRadius: "16px",
                  backgroundColor: "white",
                  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
                }}
              >
                <div className="card-body p-3">
                  <div className="mb-3">
                    <h3
                      className="mb-1 fw-bold text-dark"
                      style={{ fontSize: "1.5rem", fontFamily: "Roboto, sans-serif" }}
                    >
                      Assign Task
                    </h3>
                  </div>
                  <div className="mb-3">
                    <label
                      className="form-label fw-semibold text-dark mb-1"
                      style={{ fontSize: "0.9rem", fontFamily: "Roboto, sans-serif" }}
                    >
                      Control Number <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text bg-light border-0"
                        style={{
                          borderRadius: "8px 0 0 8px",
                          borderRight: "1px solid #e5e7eb",
                          padding: "8px 12px",
                        }}
                      >
                        <i className="fas fa-hashtag text-muted" style={{ fontSize: "0.8rem" }}></i>
                      </span>
                      <input
                        type="text"
                        value={controlNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\s/g, "");
                          if (/^\d*$/.test(value)) {
                            handleControlNumberChange({ target: { value } });
                          }
                        }}
                        className="form-control border-0 bg-light"
                        style={{
                          borderRadius: "0 8px 8px 0",
                          fontSize: "0.9rem",
                          padding: "8px 12px",
                          fontFamily: "Roboto, sans-serif",
                        }}
                        placeholder="Enter control number"
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label
                      className="form-label fw-semibold text-dark mb-2"
                      style={{ fontSize: "0.9rem", fontFamily: "Roboto, sans-serif" }}
                    >
                      Part Numbers <span className="text-danger">*</span>
                    </label>
                    <div className="bg-light p-3 rounded-3" style={{ border: "1px solid #e5e7eb" }}>
                      {partNumbers.length > 0 ? (
                        <div className="row g-2">
                          {partNumbers.map((part, index) => (
                            <div key={index} className="col-4">
                              <div className="form-check d-flex align-items-center">
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
                                  style={{
                                    transform: "scale(1.2)",
                                    marginRight: "8px",
                                    border: "2px solid #4f46e5",
                                    cursor: "pointer",
                                    width: "16px",
                                    height: "16px",
                                    accentColor: "#4f46e5",
                                  }}
                                />
                                <label
                                  className="form-check-label fw-medium text-dark"
                                  htmlFor={`part-${index}`}
                                  style={{
                                    fontSize: "0.75rem",
                                    fontFamily: "Roboto, sans-serif",
                                    cursor: "pointer",
                                    lineHeight: "1.4",
                                    wordBreak: "break-all",
                                  }}
                                >
                                  {part}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p
                          className="text-muted mb-0"
                          style={{ fontSize: "0.8rem", fontFamily: "Roboto, sans-serif" }}
                        >
                          No parts available. Enter a valid control number.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label
                      className="form-label fw-semibold text-dark mb-2"
                      style={{ fontSize: "0.9rem", fontFamily: "Roboto, sans-serif" }}
                    >
                      Assign Employees <span className="text-danger">*</span>
                    </label>
                    <div className="accordion" id="tradeAccordion">
                      {trades.map((trade, index) => {
                        const categoryColors = {
                          1: "#0275d8",
                          2: "#049a8f",
                          3: "#5cb85c",
                          4: "#5bc0de",
                          5: "#f0ad4e",
                          6: "#ecb176",
                        };
                        return (
                          <div
                            className="accordion-item border-0 mb-2"
                            key={trade.trade_id}
                            style={{
                              borderRadius: "12px",
                              overflow: "hidden",
                              boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)",
                            }}
                          >
                            <h2 className="accordion-header" id={`heading-${trade.trade_id}`}>
                              <button
                                className="accordion-button fw-semibold text-white"
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target={`#collapse-${trade.trade_id}`}
                                aria-expanded={trade.trade_id === 3 ? "true" : "false"}
                                aria-controls={`collapse-${trade.trade_id}`}
                                style={{
                                  backgroundColor: categoryColors[trade.trade_id] || "#6c757d",
                                  borderRadius: "12px",
                                  border: "none",
                                  padding: "10px 16px",
                                  fontSize: "0.9rem",
                                  fontFamily: "Roboto, sans-serif",
                                }}
                              >
                                {trade.trade_name.charAt(0).toUpperCase() + trade.trade_name.slice(1)}
                              </button>
                            </h2>
                            <div
                              id={`collapse-${trade.trade_id}`}
                              className={`accordion-collapse collapse ${trade.trade_id === 3 ? "show" : ""}`}
                              aria-labelledby={`heading-${trade.trade_id}`}
                              data-bs-parent="#tradeAccordion"
                            >
                              <div className="accordion-body bg-white p-3" style={{ maxHeight: "150px", overflowY: "auto" }}>
                                <div className="row g-2">
                                  {(employees[trade.trade_id] || []).length > 0 ? (
                                    employees[trade.trade_id].map((employee, index) => (
                                      <div key={employee.employee_id} className="col-6">
                                        <div className="form-check">
                                          <input
                                            type="checkbox"
                                            id={`emp-${employee.employee_id}`}
                                            className="form-check-input"
                                            checked={selectedEmployees[trade.trade_id]?.some(
                                              (e) => e.employee_id === employee.employee_id
                                            )}
                                            onChange={() => handleEmployeeSelection(trade.trade_id, employee)}
                                            style={{ transform: "scale(1)" }}
                                          />
                                          <label
                                            className="form-check-label fw-medium text-dark ms-1"
                                            htmlFor={`emp-${employee.employee_id}`}
                                            style={{
                                              fontSize: "0.75rem",
                                              lineHeight: "1.2",
                                              fontFamily: "Roboto, sans-serif",
                                              color: employee.employee_id === "STR-192" ? "#ff0000" : "#000000",
                                            }}
                                          >
                                            {employee.employee_name} ({employee.employee_id})
                                          </label>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-muted" style={{ fontFamily: "Roboto, sans-serif", fontSize: "0.75rem" }}>
                                      No employees available for this trade.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label
                      className="form-label fw-semibold text-dark mb-1"
                      style={{ fontSize: "0.9rem", fontFamily: "Roboto, sans-serif" }}
                    >
                      QC Required <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <select
                        value={qcRequired}
                        onChange={(e) => setQcRequired(e.target.value)}
                        className="form-control border-0 bg-light"
                        style={{
                          borderRadius: "8px",
                          padding: "8px 12px",
                          fontSize: "0.9rem",
                          fontFamily: "Roboto, sans-serif",
                        }}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                  {qcRequired === "yes" && (
                    <div className="mb-3">
                      <label
                        className="form-label fw-semibold text-primary"
                        style={{ fontSize: "0.9rem", fontFamily: "Roboto, sans-serif" }}
                      >
                        Select Employees in QC <span className="text-danger">*</span>
                      </label>
                      {qcEmployees.length > 0 ? (
                        <div className="bg-light p-3 rounded-3" style={{ border: "1px solid #e5e7eb", maxHeight: "150px", overflowY: "auto" }}>
                          {qcEmployees.map((emp) => (
                            <div className="form-check" key={emp.employee_id}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                value={emp.employee_id}
                                id={`qc-${emp.employee_id}`}
                                checked={selectedQcEmployees.includes(emp.employee_id)}
                                onChange={(e) => handleQcChange(emp.employee_id, e.target.checked)}
                                style={{ transform: "scale(1.2)", marginRight: "8px", border: "2px solid #4f46e5", cursor: "pointer" }}
                              />
                              <label
                                className="form-check-label fw-medium text-dark"
                                htmlFor={`qc-${emp.employee_id}`}
                                style={{ fontSize: "0.75rem", fontFamily: "Roboto, sans-serif" }}
                              >
                                {emp.employee_name} ({emp.employee_id})
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted" style={{ fontSize: "0.8rem", fontFamily: "Roboto, sans-serif" }}>
                          No QC employees available.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mb-3">
                    <label
                      className="form-label fw-semibold text-dark mb-1"
                      style={{ fontSize: "0.9rem", fontFamily: "Roboto, sans-serif" }}
                    >
                      Upload Document <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span
                        className="input-group-text bg-light border-0"
                        style={{
                          borderRadius: "8px 0 0 8px",
                          borderRight: "1px solid #e5e7eb",
                          padding: "8px 12px",
                        }}
                      >
                        <i className="fas fa-paperclip text-muted" style={{ fontSize: "0.8rem" }}></i>
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                        className="form-control border-0 bg-light"
                        style={{
                          borderRadius: "0 8px 8px 0",
                          padding: "8px 12px",
                          fontSize: "0.8rem",
                          fontFamily: "Roboto, sans-serif",
                        }}
                      />
                    </div>
                    {uploadedFile && (
                      <div className="mt-2">
                        <span
                          className="text-dark fw-medium"
                          style={{ fontSize: "0.8rem", fontFamily: "Roboto, sans-serif" }}
                        >
                          <i className="fas fa-file-alt text-primary me-1" style={{ fontSize: "0.8rem" }}></i>
                          {uploadedFile.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mb-3">
                    <label
                      className="form-label fw-semibold text-dark mb-1"
                      style={{ fontSize: "0.9rem", fontFamily: "Roboto, sans-serif" }}
                    >
                      Start & End Date <span className="text-danger">*</span>
                    </label>
                    <div className="row g-2">
                      <div className="col-6">
                        <div className="input-group">
                          <span
                            className="input-group-text bg-light border-0"
                            style={{
                              borderRadius: "8px 0 0 8px",
                              borderRight: "1px solid #e5e7eb",
                              padding: "8px 10px",
                            }}
                          >
                            <i className="fas fa-calendar text-muted" style={{ fontSize: "0.7rem" }}></i>
                          </span>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                              setStartDate(e.target.value);
                              if (endDate && e.target.value > endDate) {
                                setEndDate(e.target.value);
                              }
                            }}
                            className="form-control border-0 bg-light"
                            style={{
                              borderRadius: "0 8px 8px 0",
                              padding: "8px 10px",
                              fontSize: "0.8rem",
                              fontFamily: "Roboto, sans-serif",
                            }}
                          />
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="input-group">
                          <span
                            className="input-group-text bg-light border-0"
                            style={{
                              borderRadius: "8px 0 0 8px",
                              borderRight: "1px solid #e5e7eb",
                              padding: "8px 10px",
                            }}
                          >
                            <i className="fas fa-calendar text-muted" style={{ fontSize: "0.7rem" }}></i>
                          </span>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate}
                            className="form-control border-0 bg-light"
                            style={{
                              borderRadius: "0 8px 8px 0",
                              padding: "8px 10px",
                              fontSize: "0.8rem",
                              fontFamily: "Roboto, sans-serif",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary fw-semibold w-100"
                    onClick={handleAssignTask}
                    style={{
                      borderRadius: "10px",
                      padding: "12px",
                      backgroundColor: "#4f46e5",
                      borderColor: "#4f46e5",
                      fontSize: "0.9rem",
                      transition: "all 0.2s ease",
                      fontFamily: "Roboto, sans-serif",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = "#4338ca";
                      e.target.style.transform = "translateY(-1px)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "#4f46e5";
                      e.target.style.transform = "translateY(0)";
                    }}
                  >
                    <i className="fas fa-plus me-2"></i>
                    Assign Task
                  </button>
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-7">
              <div className="row g-3">
                {tasks.map((task, index) => (
                  <div key={index} className="col-12 col-md-6 col-xl-4">
                    <div
                      className="card border-0 h-100 position-relative overflow-hidden"
                      style={{
                        borderRadius: "16px",
                        background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1)",
                        minHeight: "160px",
                        border: "1px solid rgba(226, 232, 240, 0.8)",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px) scale(1.02)";
                        e.currentTarget.style.boxShadow =
                          "0 12px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(79, 70, 229, 0.3)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = "translateY(0) scale(1)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1)";
                        e.currentTarget.style.borderColor = "rgba(226, 232, 240, 0.8)";
                      }}
                    >
                      <div
                        className="position-absolute top-0 start-0 w-100"
                        style={{
                          height: "3px",
                          background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)",
                        }}
                      />
                      <div className="card-body p-3">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <span
                            className="badge px-3 py-2 fw-bold position-relative"
                            style={{
                              borderRadius: "12px",
                              fontSize: "0.75rem",
                              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                              color: "white",
                              fontFamily: "Roboto, sans-serif",
                              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                              border: "none",
                            }}
                          >
                            #{task.controlNumber}
                          </span>
                          <div
                            className="text-muted d-flex align-items-center"
                            style={{ fontSize: "0.7rem", fontFamily: "Roboto, sans-serif" }}
                          >
                            <i className="fas fa-calendar-alt me-1" style={{ fontSize: "0.65rem" }}></i>
                            {formatDate(task.startDate)}
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="d-flex align-items-center mb-2">
                            <i className="fas fa-cogs text-muted me-2" style={{ fontSize: "0.7rem" }}></i>
                            <small className="text-muted fw-medium" style={{ fontSize: "0.7rem" }}>
                              Parts
                            </small>
                          </div>
                          <div className="d-flex flex-wrap gap-1">
                            {task.parts.slice(0, 3).map((part, i) => (
                              <span
                                key={i}
                                className="badge text-dark px-2 py-1"
                                style={{
                                  borderRadius: "8px",
                                  fontSize: "0.6rem",
                                  fontWeight: "600",
                                  lineHeight: "1.2",
                                  fontFamily: "Roboto, sans-serif",
                                  background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)",
                                  border: "1px solid rgba(148, 163, 184, 0.3)",
                                  color: "#475569",
                                }}
                              >
                                {part.length > 8 ? `${part.substring(0, 8)}...` : part}
                              </span>
                            ))}
                            {task.parts.length > 3 && (
                              <span
                                className="badge px-2 py-1"
                                style={{
                                  borderRadius: "8px",
                                  fontSize: "0.6rem",
                                  lineHeight: "1.2",
                                  fontFamily: "Roboto, sans-serif",
                                  background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                                  color: "white",
                                  fontWeight: "600",
                                }}
                              >
                                +{task.parts.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mb-3">
                          <div className="d-flex align-items-center mb-2">
                            <i className="fas fa-users text-muted me-2" style={{ fontSize: "0.7rem" }}></i>
                            <small className="text-muted fw-medium" style={{ fontSize: "0.7rem" }}>
                              Assigned To
                            </small>
                          </div>
                          <div className="d-flex flex-wrap gap-1">
                            {task.employees.slice(0, 2).map((employee, i) => {
                              const category = Object.keys(employees).find((cat) =>
                                employees[cat].some((e) => e.employee_id === employee.employee_id)
                              );
                              const categoryColors = {
                                1: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                                2: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                                3: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                4: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                                5: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                                6: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                              };
                              return (
                                <span
                                  key={i}
                                  className="badge text-white px-2 py-1 position-relative"
                                  style={{
                                    background:
                                      categoryColors[category] ||
                                      "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
                                    borderRadius: "10px",
                                    fontSize: "0.6rem",
                                    fontWeight: "600",
                                    lineHeight: "1.2",
                                    fontFamily: "Roboto, sans-serif",
                                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                                  }}
                                >
                                  <i className="fas fa-user me-1" style={{ fontSize: "0.55rem" }}></i>
                                  {employee.employee_name.split(" ")[0]} ({employee.employee_id})
                                </span>
                              );
                            })}
                            {task.employees.length > 2 && (
                              <span
                                className="badge px-2 py-1"
                                style={{
                                  borderRadius: "10px",
                                  fontSize: "0.6rem",
                                  lineHeight: "1.2",
                                  fontFamily: "Roboto, sans-serif",
                                  background: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
                                  color: "white",
                                  fontWeight: "600",
                                }}
                              >
                                +{task.employees.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                        {task.qcEmployees && task.qcEmployees.length > 0 && (
                          <div className="mb-3">
                            <div className="d-flex align-items-center mb-2">
                              <i className="fas fa-user-check text-muted me-2" style={{ fontSize: "0.7rem" }}></i>
                              <small className="text-muted fw-medium" style={{ fontSize: "0.7rem" }}>
                                QC Assigned To
                              </small>
                            </div>
                            <div className="d-flex flex-wrap gap-1">
                              {task.qcEmployees.slice(0, 2).map((employee, i) => (
                                <span
                                  key={i}
                                  className="badge text-white px-2 py-1 position-relative"
                                  style={{
                                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                    borderRadius: "10px",
                                    fontSize: "0.6rem",
                                    fontWeight: "600",
                                    lineHeight: "1.2",
                                    fontFamily: "Roboto, sans-serif",
                                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                                  }}
                                >
                                  <i className="fas fa-user me-1" style={{ fontSize: "0.55rem" }}></i>
                                  {employee.employee_name.split(" ")[0]} ({employee.employee_id})
                                </span>
                              ))}
                              {task.qcEmployees.length > 2 && (
                                <span
                                  className="badge px-2 py-1"
                                  style={{
                                    borderRadius: "10px",
                                    fontSize: "0.6rem",
                                    lineHeight: "1.2",
                                    fontFamily: "Roboto, sans-serif",
                                    background: "linear-gradient(135deg, #64748b 0%, #475569 100%)",
                                    color: "white",
                                    fontWeight: "600",
                                  }}
                                >
                                  +{task.qcEmployees.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="d-flex gap-2 mt-auto">
                          <button
                            className="btn flex-fill fw-bold d-flex align-items-center justify-content-center"
                            style={{
                              borderRadius: "10px",
                              padding: "8px 12px",
                              fontSize: "0.65rem",
                              lineHeight: "1.2",
                              fontFamily: "Roboto, sans-serif",
                              background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
                              border: "none",
                              color: "white",
                              transition: "all 0.2s ease",
                              boxShadow: "0 2px 4px rgba(251, 191, 36, 0.3)",
                            }}
                            onClick={() => handleEditTask(index)}
                            onMouseOver={(e) => {
                              e.target.style.transform = "translateY(-1px)";
                              e.target.style.boxShadow = "0 4px 8px rgba(251, 191, 36, 0.4)";
                            }}
                            onMouseOut={(e) => {
                              e.target.style.transform = "translateY(0)";
                              e.target.style.boxShadow = "0 2px 4px rgba(251, 191, 36, 0.3)";
                            }}
                          >
                            <i className="fas fa-edit me-1"></i>
                            Edit
                          </button>
                          <button
                            className="btn flex-fill fw-bold d-flex align-items-center justify-content-center"
                            style={{
                              borderRadius: "10px",
                              padding: "8px 12px",
                              fontSize: "0.65rem",
                              lineHeight: "1.2",
                              fontFamily: "Roboto, sans-serif",
                              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                              border: "none",
                              color: "white",
                              transition: "all 0.2s ease",
                              boxShadow: "0 2px 4px rgba(239, 68, 68, 0.3)",
                            }}
                            onClick={() => handleDeleteTask(index)}
                            onMouseOver={(e) => {
                              e.target.style.transform = "translateY(-1px)";
                              e.target.style.boxShadow = "0 4px 8px rgba(239, 68, 68, 0.4)";
                            }}
                            onMouseOut={(e) => {
                              e.target.style.transform = "translateY(0)";
                              e.target.style.boxShadow = "0 2px 4px rgba(239, 68, 68, 0.3)";
                            }}
                          >
                            <i className="fas fa-trash me-1"></i>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {tasks.length > 0 && (
                <div className="text-center mt-4">
                  <button
                    type="button"
                    className="btn fw-bold px-5 py-3 position-relative overflow-hidden"
                    onClick={handleSubmit}
                    style={{
                      borderRadius: "16px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      border: "none",
                      color: "white",
                      fontSize: "1rem",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      fontFamily: "Roboto, sans-serif",
                      boxShadow: "0 8px 16px rgba(16, 185, 129, 0.3), 0 2px 4px rgba(16, 185, 129, 0.2)",
                      minWidth: "200px",
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = "translateY(-2px) scale(1.05)";
                      e.target.style.boxShadow =
                        "0 12px 24px rgba(16, 185, 129, 0.4), 0 4px 8px rgba(16, 185, 129, 0.3)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = "translateY(0) scale(1)";
                      e.target.style.boxShadow =
                        "0 8px 16px rgba(16, 185, 129, 0.3), 0 2px 4px rgba(16, 185, 129, 0.2)";
                    }}
                  >
                    <i className="fas fa-paper-plane me-2"></i>
                    Submit All Tasks
                    <div
                      className="position-absolute top-0 start-0 w-100 h-100"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
                        transform: "translateX(-100%)",
                        transition: "transform 0.6s ease",
                      }}
                    />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AssignTaskPage;