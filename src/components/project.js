import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

const Project = () => {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All");
  const [jobDetails, setJobDetails] = useState(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 12;

  // Dynamic heading based on filter
  const getHeading = () => {
    switch (activeFilter.toLowerCase()) {
      case "all":
        return "All Projects";
      case "ongoing":
        return "Ongoing Tasks";
      case "on hold":
        return "On Hold Tasks";
      case "completed":
        return "Completed Tasks";
      default:
        return "Projects";
    }
  };

  // Generate month and year options
  const months = [
    { value: "", label: "All Months" },
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];
  const years = [
    { value: "", label: "All Years" },
    ...Array.from({ length: 5 }, (_, i) => ({
      value: (new Date().getFullYear() - i).toString(),
      label: (new Date().getFullYear() - i).toString(),
    })),
  ];

  const handleSearch = () => {
    let filtered = tasks;
    
    if (searchTerm) {
      filtered = filtered.filter((task) =>
        String(task.control_number).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedMonth) {
      filtered = filtered.filter((task) => {
        const taskDate = new Date(task.start_date);
        return taskDate.getMonth() + 1 === parseInt(selectedMonth);
      });
    }

    if (selectedYear) {
      filtered = filtered.filter((task) => {
        const taskDate = new Date(task.start_date);
        return taskDate.getFullYear() === parseInt(selectedYear);
      });
    }

    setFilteredTasks(filtered);
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchTasksByStatus("All");
  }, []);

  useEffect(() => {
    handleSearch();
  }, [searchTerm, selectedMonth, selectedYear, tasks]);

  const fetchTasksByStatus = (status) => {
    fetch(`/api/tasks/status/${status}`)
      .then((response) => response.json())
      .then((data) => {
        setTasks(data);
        setFilteredTasks(data);
      })
      .catch((error) => {
        console.error("Error fetching tasks:", error);
        Swal.fire("Error", "Failed to fetch tasks. Please try again later.", "error");
      });
  };

  const handleFilter = (status) => {
    setActiveFilter(status);
    setCurrentPage(1);
    fetchTasksByStatus(status);
  };

  const handleHoldClick = (task) => {
    if (task.status !== "ongoing") {
      Swal.fire({
        icon: "warning",
        title: "Action Not Allowed",
        text: "Only ongoing tasks can be put on hold.",
      });
      return;
    }
    setSelectedTask(task);
    setShowHoldModal(true);
  };

  const handleViewDetails = (controlNumber, taskId) => {
    fetch(`/api/job-details/${controlNumber}/${taskId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setJobDetails(data.job_details);
        } else {
          Swal.fire("Error", "No job details found.", "error");
        }
      })
      .catch((error) => {
        console.error("Error fetching job details:", error);
        Swal.fire("Error", "Failed to fetch job details.", "error");
      });
  };

  const handleViewPDF = (docPath) => {
    if (docPath) {
      window.open(docPath, "_blank");
    } else {
      Swal.fire("Error", "No document found!", "error");
    }
  };

  const handleSubmitHoldReason = () => {
    const reason = holdReason === "Other" ? otherReason.trim() : holdReason;
    if (!reason) {
      Swal.fire("Missing Reason!", "Please select or enter a reason.", "warning");
      return;
    }
    if (selectedTask.status !== "ongoing") {
      Swal.fire("Action Not Allowed", `Cannot put task on hold. Current status: ${selectedTask.status}`, "error");
      return;
    }
    fetch("/update-job-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: selectedTask.id, status: "on hold", reason }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          Swal.fire("Task Put On Hold", "The task has been successfully moved to 'On Hold'.", "success").then(() => {
            setTasks((prevTasks) =>
              prevTasks.map((task) =>
                task.id === selectedTask.id
                  ? { ...task, status: "on hold", hold_start_date: data.hold_start_date, hold_reason: reason }
                  : task
              )
            );
            setFilteredTasks((prevFiltered) =>
              prevFiltered.map((task) =>
                task.id === selectedTask.id
                  ? { ...task, status: "on hold", hold_start_date: data.hold_start_date, hold_reason: reason }
                  : task
              )
            );
            fetchTasksByStatus(activeFilter);
            setShowHoldModal(false);
            setHoldReason("");
            setOtherReason("");
          });
        } else {
          Swal.fire("Update Failed", data.message || "Failed to update task status.", "error");
        }
      })
      .catch((error) => {
        console.error("Error updating task status:", error);
        Swal.fire("Error", "Error updating task status. Please try again.", "error");
      });
  };

  const handleReassignTask = async (task) => {
    if (task.status !== "on hold") {
      Swal.fire({
        icon: "warning",
        title: "Action Not Allowed",
        text: "Only tasks on hold can be reassigned.",
      });
      return;
    }
    try {
      const response = await fetch("/update-job-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: "ongoing" }),
      });
      const data = await response.json();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Task Reassigned",
          text: "✅ Task reassigned successfully!",
          confirmButtonColor: "#3085d6",
        }).then(() => {
          setTasks((prevTasks) =>
            prevTasks.map((t) =>
              t.id === task.id ? { ...t, status: "ongoing", hold_start_date: null, hold_reason: null } : t
            )
          );
          setFilteredTasks((prevFiltered) =>
            prevFiltered.map((t) =>
              t.id === task.id ? { ...t, status: "ongoing", hold_start_date: null, hold_reason: null } : t
            )
          );
          fetchTasksByStatus(activeFilter);
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error!",
          text: `❌ ${data.message}`,
          confirmButtonColor: "#d33",
        });
      }
    } catch (error) {
      console.error("❌ Error reassigning task:", error);
      Swal.fire({
        icon: "error",
        title: "Failed!",
        text: "🚨 Failed to reassign task.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'completed': 'bg-success',
      'in-progress': 'bg-primary',
      'pending': 'bg-warning',
      'on-hold': 'bg-secondary',
      'cancelled': 'bg-danger'
    };
    return statusClasses[status?.toLowerCase()] || 'bg-secondary';
  };

  const getStatusIcon = (status) => {
    const statusIcons = {
      'completed': 'fa-check-circle',
      'in-progress': 'fa-spinner',
      'pending': 'fa-clock',
      'on-hold': 'fa-pause-circle',
      'cancelled': 'fa-times-circle'
    };
    return statusIcons[status?.toLowerCase()] || 'fa-info-circle';
  };

  const getPriorityBadgeClass = (priority) => {
    const priorityClasses = {
      'high': 'bg-danger',
      'medium': 'bg-warning',
      'low': 'bg-success',
      'urgent': 'bg-danger'
    };
    return priorityClasses[priority?.toLowerCase()] || 'bg-secondary';
  };

  const getHeaderClass = (status) => {
    switch (status?.toLowerCase()) {
      case "ongoing":
        return "bg-primary text-white";
      case "on hold":
        return "bg-warning text-white";
      case "completed":
        return "bg-success text-white";
      case "finished":
        return "bg-secondary text-white";
      default:
        return "bg-light text-dark";
    }
  };

  const getButtonClass = (status) => {
    return activeFilter === status
      ? `btn ${getActiveButtonColor(status)}`
      : `btn ${getInactiveButtonColor(status)}`;
  };

  const getActiveButtonColor = (status) => {
    switch (status.toLowerCase()) {
      case "all":
        return "btn-dark";
      case "ongoing":
        return "btn-primary";
      case "on hold":
        return "btn-warning";
      case "completed":
        return "btn-success";
      case "finished":
        return "btn-secondary";
      default:
        return "btn-light";
    }
  };

  const getInactiveButtonColor = (status) => {
    switch (status.toLowerCase()) {
      case "all":
        return "btn-outline-dark";
      case "ongoing":
        return "btn-outline-primary";
      case "on hold":
        return "btn-outline-warning";
      case "completed":
        return "btn-outline-success";
      case "finished":
        return "btn-outline-secondary";
      default:
        return "btn-outline-light";
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-danger text-white";
      case "medium":
        return "bg-warning text-white";
      case "low":
        return "bg-success text-white";
      default:
        return "bg-secondary text-white";
    }
  };

  const handleApproveTask = (task) => {
    fetch("/update-job-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: "on hold" }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          Swal.fire("Task Approved", "Task is now on hold.", "success").then(() => {
            fetchTasksByStatus(activeFilter);
          });
        } else {
          Swal.fire("Update Failed", data.message || "Failed to update task status.", "error");
        }
      })
      .catch(() => {
        Swal.fire("Error", "Error updating task status.", "error");
      });
  };

  const handleFinish = async () => {
    const loadingSwal = Swal.fire({
      title: "Loading Projects...",
      html: '<div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await fetch("/api/control-numbers", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-cache",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          `Failed to fetch control numbers: ${res.status} ${res.statusText} - ${errorData.error || "Unknown error"}`
        );
      }

      const controlNumbers = await res.json();
      loadingSwal.close();

      if (!Array.isArray(controlNumbers)) {
        console.error("Invalid response format: Expected an array, got:", controlNumbers);
        return Swal.fire({
          icon: "error",
          title: "Data Error",
          html: `
            <div className="text-start">
              <p className="mb-2"><strong>Invalid data received from server.</strong></p>
              <p className="mb-0 text-muted small">Please contact technical support for assistance.</p>
            </div>
          `,
          confirmButtonColor: "#dc3545",
          confirmButtonText: "Close"
        });
      }

      if (controlNumbers.length === 0) {
        return Swal.fire({
          icon: "info",
          title: "No Available Projects",
          html: `
            <div className="text-center">
              <i className="fas fa-tasks fa-2x text-muted mb-3"></i>
              <p className="mb-0">All projects are either already finished or no projects are available to mark as completed.</p>
            </div>
          `,
          confirmButtonColor: "#0d6efd",
          confirmButtonText: "Understood"
        });
      }

      const { value: selectedControl } = await Swal.fire({
        title: "Mark Project as Finished",
        html: `
          <div className="text-start mb-3">
            <label className="form-label fw-bold">Select Project Control Number:</label>
            <select id="controlSelect" className="form-select form-select-lg">
              <option value="">Choose a control number...</option>
              ${controlNumbers.map(num => `<option value="${num}">${num}</option>`).join('')}
            </select>
            <small className="form-text text-muted mt-2">
              <i className="fas fa-info-circle me-1"></i>
              This action will permanently mark the selected project as finished.
            </small>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i className="fas fa-check me-2"></i>Mark as Finished',
        cancelButtonText: '<i className="fas fa-times me-2"></i>Cancel',
        confirmButtonColor: "#198754",
        cancelButtonColor: "#6c757d",
        customClass: {
          popup: 'swal2-lg'
        },
        preConfirm: () => {
          const select = document.getElementById('controlSelect');
          const value = select.value;
          if (!value) {
            Swal.showValidationMessage('Please select a control number');
            return false;
          }
          return value;
        },
        didOpen: () => {
          document.getElementById('controlSelect').focus();
        }
      });

      if (selectedControl) {
        const confirmResult = await Swal.fire({
          title: "Confirm Action",
          html: `
            <div className="text-center">
              <i className="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
              <p className="mb-2">Are you sure you want to mark project <strong>${selectedControl}</strong> as finished?</p>
              <p className="text-muted small mb-0">This action cannot be undone.</p>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: '<i className="fas fa-check-circle me-2"></i>Yes, Mark as Finished',
          cancelButtonText: '<i className="fas fa-arrow-left me-2"></i>Go Back',
          confirmButtonColor: "#198754",
          cancelButtonColor: "#6c757d",
          focusCancel: true
        });

        if (confirmResult.isConfirmed) {
          const updatingSwal = Swal.fire({
            title: "Updating Project...",
            html: `
              <div className="text-center">
                <div className="spinner-border text-success mb-3" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mb-0">Marking <strong>${selectedControl}</strong> as finished...</p>
              </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });

          try {
            const updateRes = await fetch("/api/control-numbers", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ control_number: selectedControl }),
            });

            const data = await updateRes.json();
            updatingSwal.close();

            if (data.success) {
              await Swal.fire({
                icon: "success",
                title: "Project Completed!",
                html: `
                  <div className="text-center">
                    <i className="fas fa-check-circle fa-3x text-success mb-3"></i>
                    <p className="mb-2">Project <strong>${selectedControl}</strong> has been successfully marked as finished.</p>
                    <p className="text-muted small mb-0">The project list will be refreshed automatically.</p>
                  </div>
                `,
                confirmButtonColor: "#198754",
                confirmButtonText: "Great!",
                timer: 3000,
                timerProgressBar: true
              });

              fetchTasksByStatus(activeFilter);
            } else {
              Swal.fire({
                icon: "error",
                title: "Update Failed",
                html: `
                  <div className="text-start">
                    <p className="mb-2"><strong>Failed to mark project as finished.</strong></p>
                    <p className="mb-2 text-muted">${data.error || "An unexpected error occurred."}</p>
                    <p className="mb-0 small">Please try again or contact support if the problem persists.</p>
                  </div>
                `,
                confirmButtonColor: "#dc3545",
                confirmButtonText: "Try Again"
              });
            }
          } catch (e) {
            updatingSwal.close();
            console.error("Error updating project:", e.message);
            Swal.fire({
              icon: "error",
              title: "Network Error",
              html: `
                <div className="text-start">
                  <p className="mb-2"><strong>Failed to update project due to network error.</strong></p>
                  <p className="mb-2 text-muted">${e.message}</p>
                  <p className="mb-0 small">Please check your internet connection and try again.</p>
                </div>
              `,
              confirmButtonColor: "#dc3545",
              confirmButtonText: "Retry"
            });
          }
        }
      }
    } catch (error) {
      loadingSwal.close();
      console.error("Error in handleFinish:", error.message);
      Swal.fire({
        icon: "error",
        title: "Loading Error",
        html: `
          <div className="text-start">
            <p className="mb-2"><strong>Failed to load control numbers.</strong></p>
            <p className="mb-2 text-muted">${error.message}</p>
            <p className="mb-0 small">Please check server status or contact technical support.</p>
          </div>
        `,
        confirmButtonColor: "#dc3545",
        confirmButtonText: "Close"
      });
    }
  };

  const indexOfLastTask = currentPage * tasksPerPage;
  const indexOfFirstTask = indexOfLastTask - tasksPerPage;
  const currentTasks = filteredTasks.slice(indexOfFirstTask, indexOfLastTask);
  const totalPages = Math.ceil(filteredTasks.length / tasksPerPage);

  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <section className="content">
      <div className="content-wrapper py-4">
        <div className="container-fluid">
          <div className="card-header bg-white border-bottom mb-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-4">
              <h3 className="fw-semibold mb-0 text-dark" style={{ fontSize: '1.5rem' }}>{getHeading()}</h3>
              <div className="d-flex flex-column flex-md-row gap-3">
                <input
                  type="text"
                  placeholder="Search by Control Number"
                  className="form-control form-control-sm border-2 shadow-sm"
                  style={{ maxWidth: '250px', borderRadius: '8px', padding: '0.5rem 1rem' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  className="form-select form-select-sm border-2 shadow-sm"
                  style={{ maxWidth: '150px', borderRadius: '8px', padding: '0.5rem 1rem' }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm border-2 shadow-sm"
                  style={{ maxWidth: '150px', borderRadius: '8px', padding: '0.5rem 1rem' }}
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                >
                  {years.map((year) => (
                    <option key={year.value} value={year.value}>{year.label}</option>
                  ))}
                </select>
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                {["All", "ongoing", "on hold", "completed"].map((status) => (
                  <button
                    key={status}
                    className={`btn btn-sm fw-medium ${getButtonClass(status)}`}
                    style={{ borderRadius: '8px', padding: '0.5rem 1rem', transition: 'all 0.2s' }}
                    onClick={() => handleFilter(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
                <button 
                  className="btn btn-sm btn-primary fw-medium" 
                  style={{ borderRadius: '8px', padding: '0.5rem 1rem' }}
                  onClick={handleFinish}
                >
                  Finish
                </button>
              </div>
            </div>
          </div>
          <div className="row g-5">
            {currentTasks.length === 0 ? (
              <div className="text-center py-5 text-muted fw-medium">
                No tasks found for this status.
              </div>
            ) : (
              currentTasks.map((task) => {
                const partNumbers = String(task.part_number).split(",");
                return (
                  <div key={`${task.id}-${task.control_number}`} className="col-xl-3 col-lg-4 col-md-6 col-12">
                    <div 
                      className="card h-100 border-0 task-card position-relative" 
                      style={{
                        borderRadius: '12px',
                        boxShadow: '0 6px 24px rgba(0,0,0,0.1)',
                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                        background: '#ffffff',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div className="position-absolute" style={{ top: '12px', right: '12px', zIndex: 10 }}>
                        <span 
                          className={`badge px-3 py-1 ${getPriorityClass(task.priority)}`} 
                          style={{
                            fontSize: '0.75rem',
                            borderRadius: '20px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}
                        >
                          {task.priority || "N/A"}
                        </span>
                      </div>
                      <div 
                        className={`card-header border-0 ${getHeaderClass(task.status)}`} 
                        style={{
                          borderRadius: '12px 12px 0 0',
                          padding: '1rem 1.25rem',
                          background: `linear-gradient(135deg, var(--header-color-1), var(--header-color-2))`,
                          minHeight: '60px'
                        }}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <div 
                            className="bg-white rounded-circle p-2" 
                            style={{
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          >
                            <i className="fas fa-tasks text-primary" style={{ fontSize: '1rem' }}></i>
                          </div>
                          <div className="flex-grow-1">
                            <h6 className="fw-bold mb-1 text-white" style={{ fontSize: '1rem' }}>
                              {task.control_number}
                            </h6>
                            <p className="mb-0 text-white-75" style={{ fontSize: '0.75rem' }}>
                              Control Number
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="card-body p-3">
                        <div className="mb-3">
                          <span className="fw-semibold text-dark d-block" style={{ fontSize: '0.85rem' }}>
                            Part Numbers:
                          </span>
                          <p 
                            className="mb-0 text-muted" 
                            style={{
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              background: '#f8f9fa',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              lineHeight: '1.4'
                            }}
                          >
                            {partNumbers.join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="card-footer bg-transparent border-top p-3">
                        <div className="d-flex justify-content-between align-items-center gap-2">
                          <div className="d-flex gap-2">
                            <button
                              className="btn btn-outline-primary btn-sm fw-medium"
                              onClick={() => handleViewDetails(task.control_number, task.id)}
                              style={{
                                borderRadius: '8px',
                                padding: '0.4rem 1rem',
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                              title="View Details"
                            >
                              <i className="fas fa-eye me-1"></i>
                              View
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm fw-medium"
                              onClick={() => handleViewPDF(task.doc_upload_path)}
                              style={{
                                borderRadius: '8px',
                                padding: '0.4rem 1rem',
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                              title="View PDF"
                            >
                              <i className="fas fa-file-pdf me-1"></i>
                              PDF
                            </button>
                          </div>
                          <div>
                            {task.status === "ongoing" && (
                              <button
                                className="btn btn-warning btn-sm fw-medium"
                                onClick={() => handleHoldClick(task)}
                                style={{
                                  borderRadius: '8px',
                                  padding: '0.4rem 1rem',
                                  fontSize: '0.8rem',
                                  transition: 'all 0.2s'
                                }}
                                title="Request Hold"
                              >
                                <i className="fas fa-hand-paper me-1"></i>
                                Hold
                              </button>
                            )}
                            {task.status === "pending" && (
                              <button
                                className="btn btn-success btn-sm fw-medium"
                                onClick={() => handleApproveTask(task)}
                                style={{
                                  borderRadius: '8px',
                                  padding: '0.4rem 1rem',
                                  fontSize: '0.8rem',
                                  transition: 'all 0.2s'
                                }}
                                title="Approve Hold Request"
                              >
                                <i className="fas fa-check me-1"></i>
                                Approve
                              </button>
                            )}
                            {task.status === "on hold" && (
                              <button
                                className="btn btn-info btn-sm fw-medium"
                                onClick={() => handleReassignTask(task)}
                                style={{
                                  borderRadius: '8px',
                                  padding: '0.4rem 1rem',
                                  fontSize: '0.8rem',
                                  transition: 'all 0.2s'
                                }}
                                title="Reassign Task"
                              >
                                <i className="fas fa-redo me-1"></i>
                                Reassign
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {filteredTasks.length > tasksPerPage && (
            <div className="d-flex justify-content-center mt-4">
              <nav aria-label="Page navigation">
                <ul className="pagination">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => paginate(page)}
                      >
                        {page}
                      </button>
                    </li>
                  ))}
                  <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
          {jobDetails && (
            <div className="modal fade show" id="jobDetailsModal" tabIndex="-1" role="dialog" style={{ display: "block" }}>
              <div className="modal-dialog modal-xl" role="document">
                <div className="modal-content border-0 shadow-lg">
                  <div className={`modal-header ${getHeaderClass(jobDetails.status)} border-0`}>
                    <div className="d-flex align-items-center">
                      <div className="bg-white bg-opacity-20 rounded-circle p-2 me-3">
                        <i className="fas fa-briefcase text-white"></i>
                      </div>
                      <div>
                        <h4 className="modal-title text-white mb-0 fw-bold">Job Details</h4>
                        <small className="text-white-50">Control #{jobDetails.control_number}</small>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      aria-label="Close"
                      onClick={() => setJobDetails(null)}
                    ></button>
                  </div>
                  <div className="modal-body p-4">
                    <div className="mb-4">
                      <span className={`badge fs-6 px-3 py-2 ${getStatusBadgeClass(jobDetails.status)}`}>
                        <i className={`fas ${getStatusIcon(jobDetails.status)} me-2`}></i>
                        {jobDetails.status}
                      </span>
                    </div>
                    <div className="row g-4 mb-4">
                      <div className="col-md-6">
                        <div className="card border-0 bg-light h-100">
                          <div className="card-body">
                            <h6 className="card-title text-primary mb-3">
                              <i className="fas fa-calendar-alt me-2"></i>Schedule Information
                            </h6>
                            <div className="row">
                              <div className="col-6">
                                <small className="text-muted d-block">Start Date</small>
                                <strong>{new Date(jobDetails.start_date).toLocaleDateString('en-GB')}</strong>
                              </div>
                              <div className="col-6">
                                <small className="text-muted d-block">End Date</small>
                                <strong>{new Date(jobDetails.end_date).toLocaleDateString('en-GB')}</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card border-0 bg-light h-100">
                          <div className="card-body">
                            <h6 className="card-title text-success mb-3">
                              <i className="fas fa-cogs me-2"></i>Job Information
                            </h6>
                            <div className="row">
                              <div className="col-6">
                                <small className="text-muted d-block">Group Section</small>
                                <strong>{jobDetails.group_section}</strong>
                              </div>
                              <div className="col-6">
                                <small className="text-muted d-block">Priority</small>
                                <span className={`badge ${getPriorityBadgeClass(jobDetails.priority)}`}>
                                  {jobDetails.priority}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {(jobDetails.total_mandays != null || jobDetails.delayed_ontime) && (
                      <div className="row g-3 mb-4">
                        {jobDetails.total_mandays != null && (
                          <div className="col-md-6">
                            <div className="text-center p-3 bg-warning bg-opacity-10 rounded">
                              <div className="fs-4 fw-bold text-warning">{jobDetails.total_mandays}</div>
                              <small className="text-muted">Man Days</small>
                            </div>
                          </div>
                        )}
                        {jobDetails.delayed_ontime && (
                          <div className="col-md-6">
                            <div className="text-center p-3 bg-secondary bg-opacity-10 rounded">
                              <div className="fs-6 fw-bold text-secondary">{jobDetails.delayed_ontime}</div>
                              <small className="text-muted">Status</small>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="card border-0 bg-light mb-4">
                      <div className="card-header bg-transparent border-0 pb-0">
                        <h6 className="mb-0 text-primary">
                          <i className="fas fa-boxes me-2"></i>Part Details
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-hover">
                            <thead className="table-light">
                              <tr>
                                <th className="border-0">Part Number</th>
                                <th className="border-0">Quantity</th>
                                <th className="border-0">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {jobDetails.part_details.map((part, index) => (
                                <tr key={index}>
                                  <td className="border-0">
                                    <code className="bg-light px-2 py-1 rounded">{part.part_number}</code>
                                  </td>
                                  <td className="border-0">
                                    <span className="badge bg-primary">{part.quantity}</span>
                                  </td>
                                  <td className="border-0">{part.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    <div className="card border-0 bg-light">
                      <div className="card-header bg-transparent border-0 pb-0">
                        <h6 className="mb-0 text-primary">
                          <i className="fas fa-users me-2"></i>Assigned Team
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="d-flex flex-wrap gap-2">
                          {jobDetails.employee_names.split(',').map((name, index) => (
                            <span key={index} className="badge bg-success bg-opacity-10 text-success px-3 py-2">
                              <i className="fas fa-user me-1"></i>{name.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer border-0 bg-light">
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary px-4" 
                      onClick={() => setJobDetails(null)}
                    >
                      <i className="fas fa-times me-2"></i>Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {showHoldModal && (
            <div className="modal fade show" style={{ display: "block" }}>
              <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg">
                  <div className="modal-header bg-warning text-white border-0">
                    <div className="d-flex align-items-center">
                      <div className="bg-white bg-opacity-20 rounded-circle p-2 me-3">
                        <i className="fas fa-pause text-white"></i>
                      </div>
                      <h5 className="modal-title mb-0 fw-bold">Hold Task</h5>
                    </div>
                    <button 
                      type="button" 
                      className="btn-close btn-close-white" 
                      onClick={() => setShowHoldModal(false)}
                    ></button>
                  </div>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label fw-semibold">
                        <i className="fas fa-list me-2 text-warning"></i>Select Reason
                      </label>
                      <select
                        className="form-select form-select-lg border-2"
                        value={holdReason}
                        onChange={(e) => setHoldReason(e.target.value)}
                      >
                        <option value="">Choose a reason...</option>
                        <option value="High Priority">🔥 High Priority</option>
                        <option value="Incomplete">⏳ Incomplete</option>
                        <option value="Unavailable">❌ Unavailable</option>
                        <option value="Waiting for Parts">📦 Waiting for Parts</option>
                        <option value="Quality Issue">⚠️ Quality Issue</option>
                        <option value="Other">✏️ Other</option>
                      </select>
                    </div>
                    {holdReason === "Other" && (
                      <div className="mb-3">
                        <label className="form-label fw-semibold">
                          <i className="fas fa-edit me-2 text-secondary"></i>Specify Reason
                        </label>
                        <textarea
                          className="form-control border-2"
                          rows="3"
                          placeholder="Please provide details about the hold reason..."
                          value={otherReason}
                          onChange={(e) => setOtherReason(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div className="modal-footer border-0 bg-light">
                    <button 
                      className="btn btn-outline-secondary px-4" 
                      onClick={() => setShowHoldModal(false)}
                    >
                      <i className="fas fa-times me-2"></i>Cancel
                    </button>
                    <button 
                      className="btn btn-warning px-4" 
                      onClick={handleSubmitHoldReason}
                      disabled={!holdReason || (holdReason === "Other" && !otherReason.trim())}
                    >
                      <i className="fas fa-pause me-2"></i>Hold Task
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Project;