import React, { useEffect } from "react";

const ViewEmployeeModal = ({ employee, onClose, onEdit }) => {
  // Close the modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`modal show d-block`}
      role="dialog"
      aria-labelledby="viewEmployeeModal"
      aria-hidden="true"
    >
      <div className="modal-dialog">
        <div className="modal-content" role="document">
          <div className="modal-header">
            <h5 className="modal-title" id="viewEmployeeModal">Profile</h5>
            <button
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            {employee ? (
              <>
                <p><strong>Employee ID:</strong> {employee.employee_id}</p>
                <p><strong>Name:</strong> {employee.employee_name}</p>
                <p><strong>Designation:</strong> {employee.designation}</p>
                <p><strong>Email:</strong> {employee.email_id}</p>
                <p><strong>Phone:</strong> {employee.phone_number}</p>

               
              </>
            ) : (
              <p>Employee data not available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewEmployeeModal;
