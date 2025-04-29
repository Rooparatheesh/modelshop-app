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


  const handleSearch = (value) => {
    const searchTerm = value.toLowerCase();
    const filtered = tasks.filter((task) =>
      String(task.control_number).toLowerCase().includes(searchTerm)
    );
    setFilteredTasks(filtered);
  };


  useEffect(() => {
    fetchTasksByStatus("All");
  }, []);

  const fetchTasksByStatus = (status) => {
    fetch(`/api/tasks/status/${status}`)
      .then((response) => response.json())
      .then((data) => {
        
        setTasks(data);
        setFilteredTasks(data);
      })
      .catch((error) => {
        console.error("Error fetching tasks:", error);
        alert("Failed to fetch tasks. Please try again later.");
      });
  };

  const handleFilter = (status) => {
    setActiveFilter(status);
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
          setJobDetails(data.job_details); // Set all job details
        } else {
          alert("No job details found.");
        }
      })
      .catch((error) => {
        console.error("Error fetching job details:", error);
        alert("Failed to fetch job details.");
      });
  };

  const handleViewPDF = (docPath) => {
    if (docPath) {
      window.open(docPath, "_blank"); // Open the document in a new tab
    } else {
      alert("No document found!");
    }
  };

  const handleSubmitHoldReason = () => {
    const reason = holdReason === "Other" ? otherReason.trim() : holdReason;
  
    if (!reason) {
      Swal.fire("Missing Reason!", "Please select or enter a reason.", "warning");
      return;
    }
  
    // Ensure the current task status allows being put on hold
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
            // Update task status in UI
            setTasks((prevTasks) =>
              prevTasks.map((task) =>
                task.id === selectedTask.id ? { ...task, status: "on hold" } : task
              )
            );
  
            fetchTasksByStatus(activeFilter); // Refresh task list
            setShowHoldModal(false); // Close modal
            setHoldReason(""); // Reset fields
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
  
  const getHeaderClass = (status) => {
    switch (status?.toLowerCase()) {
      case "ongoing":
        return "bg-success text-white";
      case "on hold":
        return "bg-warning text-dark";
      case "completed":
        return "bg-primary text-white"; // Blue
      case "finished":
        return "bg-info text-dark"; // Light blue
      default:
        return "bg-secondary text-white";
    }
  };
  

// Assign colors to filter buttons based on status
const getButtonClass = (status) => {
  return activeFilter === status
    ? `btn ${getActiveButtonColor(status)}`
    : `btn ${getInactiveButtonColor(status)}`;
};
const handleReassignTask = async (task) => {
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
      });

      // Refresh the task list or update UI if needed
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
// Active button colors
const getActiveButtonColor = (status) => {
  switch (status.toLowerCase()) {
    case "all":
      return "btn-dark";
    case "ongoing":
      return "btn-success"; // Green for Ongoing
    case "on hold":
      return "btn-warning";
    case "completed":
      return "btn-primary"; // Blue for Completed
    
    default:
      return "btn-secondary";
  }
};

// Inactive (outline) button colors
const getInactiveButtonColor = (status) => {
  switch (status.toLowerCase()) {
    case "all":
      return "btn-outline-dark";
    case "ongoing":
      return "btn-outline-success"; // Green outline for Ongoing
    case "on hold":
      return "btn-outline-warning";
    case "completed":
      return "btn-outline-primary"; // Blue outline for Completed
   
    default:
      return "btn-outline-secondary";
  }
};

const getPriorityClass = (priority) => {
  switch (priority?.toLowerCase()) {
    case "high":
      return "bg-danger";
    case "medium":
      return "bg-warning text-dark";
    case "low":
      return "bg-success";
    default:
      return "bg-secondary";
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
  try {
    // Fetch available control numbers
    const res = await fetch("/api/control-numbers");
    const controlNumbers = await res.json();

    if (controlNumbers.length === 0) {
      return Swal.fire("No Available Projects", "All control numbers are already finished.", "info");
    }

    // Show the modal with dropdown
    Swal.fire({
      title: "Mark Project as Finished",
      html: `
        <select id="controlSelect" class="swal2-input">
          ${controlNumbers.map(
            (num) => `<option value="${num}">${num}</option>`
          ).join("")}
        </select>
      `,
      showCancelButton: true,
      confirmButtonText: "Submit",
      preConfirm: () => {
        const selected = document.getElementById("controlSelect").value;
        if (!selected) {
          Swal.showValidationMessage("Please select a control number");
        }
        return selected;
      },
    }).then((result) => {
      if (result.isConfirmed) {
        const selectedControl = result.value;

        // Call same API with PUT to update status
        fetch("/api/control-numbers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ control_number: selectedControl }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              Swal.fire("Success", `${selectedControl} marked as finished.`, "success");
              // Optional: Refresh your data table or UI here
            } else {
              Swal.fire("Error", data.error || "Failed to update status.", "error");
            }
          })
          .catch(() => {
            Swal.fire("Error", "Something went wrong during the update.", "error");
          });
      }
    });

  } catch (error) {
    console.error("Error fetching control numbers:", error);
    Swal.fire("Error", "Failed to load control numbers.", "error");
  }
};

return (
  <section className="content">
  <div className="content-wrapper">
    <div className="container-fluid">

      {/* Header with Status Filters */}
      <div className="card-header">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <h3 className="fw-bold mb-0">Projects</h3>

          <input
            type="text"
            placeholder="Search by Control Number"
            className="form-control form-control-sm"
            style={{ maxWidth: "200px" }}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {["All", "ongoing", "on hold", "completed", ].map((status) => (
              <button
                key={status}
                className={`btn btn-sm ${getButtonClass(status)}`}
                onClick={() => handleFilter(status)}
              >
                {status}
              </button>
            ))}

            {/* ✅ Finish Button */}
            <button
              className="btn btn-sm btn-success"
              onClick={handleFinish}
            >
              Finish
            </button>
          </div>
        </div>
      </div>

      {/* Task Cards */}
      <div className="row">
        {filteredTasks.length === 0 ? (
          <div>No tasks found for this status.</div>
        ) : (
          filteredTasks.map((task) => {
            const partNumbers = String(task.part_number).split(",");
            console.log("Task Object:", task);


            return (
              <div key={`${task.id}-${task.control_number}`} className="col-md-3 col-sm-6 col-12 mb-2">
               <div className={`card h-100 shadow-sm small-card position-relative`}>

      
                  {/* Card Header - Displays Control Number with Status-Based Color */}
                  <div className={`card-header py-1 px-2 ${getHeaderClass(task.status)}`}>  
                    <h6 className="fw-bold mb-0 small text-truncate">Control No: {task.control_number}</h6>
                    <span className={`badge ml-2 ${getPriorityClass(task.priority)}`}>
  {task.priority || "Not Assigned"}
</span>


                  </div>
                  {/* Card Body */}
                  <div className="card-body d-flex flex-column p-2">
                    <p className="card-text mb-1 small text-truncate">
                      <strong>Part Numbers:</strong> {partNumbers.slice(0, 2).join(", ")}
                    </p>
                    <p className="small text-muted text-truncate">
                      Start: {new Date(task.start_date).toLocaleDateString()} | 
                      End: {new Date(task.end_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="card-footer d-flex justify-content-between p-1">
  {/* View Details */}
  <button
    className="btn btn-outline-primary btn-xs"
    onClick={() => handleViewDetails(task.control_number, task.id)}
  >
    <i className="fas fa-eye"></i>
  </button>

  {/* View PDF */}
  <button
    className="btn btn-outline-info btn-xs"
    onClick={() => handleViewPDF(task.doc_upload_path)}
  >
    <i className="fas fa-file-pdf"></i>
  </button>

  {/* Request Hold - Only show if status is "ongoing" */}
  {task.status === "ongoing" && (
    <button
      className="btn btn-outline-warning btn-xs"
      onClick={() => handleHoldClick(task)}
      title="Request Hold"
    >
      <i className="fas fa-hand-paper"></i>
    </button>
  )}

  {/* Approve Hold - Only show if status is "pending" */}
  {task.status === "pending" && (
    <button
      className="btn btn-info btn-xs"
      onClick={() => handleApproveTask(task)}
      title="Approve Hold Request"
    >
      Approve
    </button>
  )}

  {/* Reassign - Only show if status is "on hold" */}
  {task.status === "on hold" && (
    <button
      className="btn btn-outline-danger btn-xs"
      onClick={() => handleReassignTask(task)}
      title="Reassign Task"
    >
      Reassign
    </button>
  )}
</div>
                </div>
              </div>
            );
          })
        )}
      </div>
   

         {/* Job Details Modal */}
{jobDetails && (
  <div className="modal fade show" id="jobDetailsModal" tabIndex="-1" role="dialog" style={{ display: "block" }}>
    <div className="modal-dialog modal-lg" role="document">
      <div className="modal-content">
        
        {/* Modal Header with Dynamic Color */}
        <div className={`modal-header ${getHeaderClass(jobDetails.status)}`}>
          <h5 className="modal-title text-white">Job Details</h5>
          <button
            type="button"
            className="close text-white"
            data-dismiss="modal"
            aria-label="Close"
            onClick={() => setJobDetails(null)}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          <div className="row">
            <div className="col-md-6">
              <p><strong>Control Number:</strong> {jobDetails.control_number}</p>
              <p><strong>Start Date:</strong> {new Date(jobDetails.start_date).toLocaleDateString()}</p>
              <p><strong>End Date:</strong> {new Date(jobDetails.end_date).toLocaleDateString()}</p>
            </div>
            <div className="col-md-6">
              <p><strong>Status:</strong> {jobDetails.status}</p>
              <p><strong>Group Section:</strong> {jobDetails.group_section}</p>
              <p><strong>Priority:</strong> {jobDetails.priority}</p>
            </div>
          </div>

          <div className="mt-3">
            <h6>Part Details:</h6>
            <ul>
              {jobDetails.part_details.map((part, index) => (
                <li key={index}>
                  <strong>Part Number:</strong> {part.part_number} | 
                  <strong> Quantity:</strong> {part.quantity} | 
                  <strong> Description:</strong> {part.description}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3">
            <h6>Assigned Employees:</h6>
            <p>{jobDetails.employee_names}</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setJobDetails(null)}>Close</button>
        </div>
      </div>
    </div>
  </div>
)}


          {showHoldModal && (
        <div className="modal fade show" style={{ display: "block" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Hold Task</h5>
                <button type="button" className="close" onClick={() => setShowHoldModal(false)}>
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <label><strong>Select Reason:</strong></label>
                <select className="form-control" value={holdReason} onChange={(e) => setHoldReason(e.target.value)}>
                  <option value="">Select</option>
                  <option value="High Priority">High Priority</option>
                  <option value="Other">Other</option>
                </select>
                {holdReason === "Other" && (
                  <input
                    type="text"
                    className="form-control mt-2"
                    placeholder="Enter reason"
                    value={otherReason}
                    onChange={(e) => setOtherReason(e.target.value)}
                  />
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowHoldModal(false)}>Cancel</button>
                <button className="btn btn-warning" onClick={handleSubmitHoldReason}>Submit</button>
                
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
