import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";

function WorkOrderForm() {
  const [formData, setFormData] = useState({
    workOrderNumber: "",
    controlNumber: "",
    projectCode: "",
    priority: "",
    groupWorkOrder: "",
    workOrderDate: "",
    receivedDate: "",
    desiredCompletionDate: "",
    productDescription: "",
    document: null,
    parts: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const requiredFields = [
    "workOrderNumber",
    "controlNumber",
    "projectCode",
    "groupWorkOrder",
    "priority",
    "productDescription",
    "workOrderDate",
    "receivedDate",
    "desiredCompletionDate",
    "document",
  ];

  useEffect(() => {
    const savedDraft = localStorage.getItem("workOrderDraft");
    if (location.state?.fromSubmission) {
      Swal.fire({
        title: "Success",
        text: "Parts submitted successfully. Start a new work order?",
        icon: "success",
        confirmButtonText: "OK",
        timer: 1500,
      });
    } else if (savedDraft) {
      setFormData(JSON.parse(savedDraft));
    }
  }, [location.state]);

  const validateDates = (name, value, formData) => {
    const { workOrderDate, receivedDate } = formData;
    if (name === "receivedDate" && workOrderDate && new Date(value) < new Date(workOrderDate)) {
      return "Received Date must be on or after Work Order Date";
    }
    if (name === "desiredCompletionDate") {
      if (workOrderDate && new Date(value) < new Date(workOrderDate)) {
        return "Desired Completion Date must be on or after Work Order Date";
      }
      if (receivedDate && new Date(value) <= new Date(receivedDate)) {
        return "Desired Completion Date must be after Received Date";
      }
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    const newValue = type === "file" ? files[0] : value;

    if (name === "controlNumber" && !/^\d*$/.test(value)) {
      Swal.fire({
        title: "Error",
        text: "Control Number must be numeric.",
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    const dateError = validateDates(name, newValue, formData);
    if (dateError) {
      Swal.fire({
        title: "Error",
        text: dateError,
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    setFormData({ ...formData, [name]: newValue });
  };

  const handleSaveDraft = () => {
    localStorage.setItem("workOrderDraft", JSON.stringify(formData));
    Swal.fire({
      title: "Saved!",
      text: "Draft saved successfully!",
      icon: "success",
      confirmButtonText: "OK",
    });
  };

  const handleNext = async () => {
    if (isLoading) return;

    const missingFields = requiredFields.filter(
      (field) => !formData[field] || formData[field].toString().trim() === ""
    );
    if (missingFields.length > 0) {
      Swal.fire({
        title: "Error",
        text: `Please fill in all required fields: ${missingFields.join(", ")}`,
        icon: "error",
        confirmButtonText: "OK",
      });
      return;
    }

    setIsLoading(true);
    const formDataToSend = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "document" && value instanceof File) {
        formDataToSend.append("document", value);
      } else if (key !== "parts") {
        formDataToSend.append(key, value);
      }
    });

    try {
      const authToken = localStorage.getItem("authToken");
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/work-order`, {
        method: "POST",
        headers,
        body: formDataToSend,
      });

      if (!response.ok) {
        let errorMessage = "Failed to save work order";
        if (response.status === 401 || response.status === 403) {
          errorMessage = "Session expired. Please log in again.";
        } else {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || response.statusText;
          } catch {
            errorMessage = response.statusText || "An unexpected error occurred";
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Work Order API Response:", data);

      if (!data.controlNumber) {
        throw new Error("Control Number missing in response.");
      }

      localStorage.setItem("lastControlNumber", data.controlNumber);
      setFormData({
        workOrderNumber: "",
        controlNumber: "",
        projectCode: "",
        priority: "",
        groupWorkOrder: "",
        workOrderDate: "",
        receivedDate: "",
        desiredCompletionDate: "",
        productDescription: "",
        document: null,
        parts: [],
      });
      const fileInput = document.querySelector('input[name="document"]');
      if (fileInput) fileInput.value = "";
      localStorage.removeItem("workOrderDraft");

      navigate("/part", {
        state: {
          formData: { ...formData, controlNumber: data.controlNumber },
        },
      });
    } catch (error) {
      console.error("Error saving work order:", error);
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to save work order. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
      if (error.message.includes("Session expired")) {
        localStorage.removeItem("authToken");
        navigate("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = requiredFields.every(
    (field) => formData[field] && formData[field].toString().trim() !== ""
  );

  return (
    <section className="content">
      <div className="content-wrapper" style={{ marginTop: "40px", marginLeft: "250px" }}>
        <div className="card card-primary" style={{ width: "98%", margin: "0 auto", marginBottom: "30px" }}>
          <div className="card-header" style={{ marginBottom: "40px" }}>
            <h3 className="card-title">Work Order Form</h3>
          </div>
          <div className="card-body">
            <form>
              <div className="form-group" style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: "1" }}>
                  <label htmlFor="workOrderNumber">
                    Work Order Number <span className="text-danger">*</span>
                  </label>
                  <input
                    id="workOrderNumber"
                    type="text"
                    className={`form-control ${!formData.workOrderNumber  || ""}`}
                    name="workOrderNumber"
                    value={formData.workOrderNumber}
                    onChange={handleChange}
                    required
                    aria-required="true"
                  />
                
                </div>
                <div style={{ flex: "1" }}>
                  <label htmlFor="controlNumber">
                    Control Number <span className="text-danger">*</span>
                  </label>
                  <input
  id="controlNumber"
  type="text"
  className="form-control"
  name="controlNumber"
  value={formData.controlNumber || ""}
  onChange={handleChange}
  required
  aria-required="true"
/>

          
                </div>
              </div>

              <div className="form-group" style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: "1" }}>
                  <label htmlFor="projectCode">
                    Project Code <span className="text-danger">*</span>
                  </label>
                  <input
                    id="projectCode"
                    type="text"
                    className="form-control"
                    name="projectCode"
                    value={formData.projectCode}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[A-Za-z0-9\s]*$/.test(value)) {
                        handleChange(e);
                      }
                    }}
                    required
                  />
                </div>
                <div style={{ flex: "1" }}>
                  <label htmlFor="groupWorkOrder">
                    Group / Section <span className="text-danger">*</span>
                  </label>
                  <input
                    id="groupWorkOrder"
                    type="text"
                    className="form-control"
                    name="groupWorkOrder"
                    value={formData.groupWorkOrder}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: "1" }}>
                  <label htmlFor="priority">
                    Priority <span className="text-danger">*</span>
                  </label>
                  <select
                    id="priority"
                    className="form-control"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Priority</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div style={{ flex: "1" }}>
                  <label htmlFor="productDescription">
                    Product Description <span className="text-danger">*</span>
                  </label>
                  <input
                    id="productDescription"
                    type="text"
                    className="form-control"
                    name="productDescription"
                    value={formData.productDescription}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[A-Za-z\s]*$/.test(value)) {
                        handleChange(e);
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: "1" }}>
                  <label htmlFor="workOrderDate">
                    Work Order Date <span className="text-danger">*</span>
                  </label>
                  <input
                    id="workOrderDate"
                    type="date"
                    className="form-control"
                    name="workOrderDate"
                    value={formData.workOrderDate}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div style={{ flex: "1" }}>
                  <label htmlFor="receivedDate">
                    Received Date <span className="text-danger">*</span>
                  </label>
                  <input
                    id="receivedDate"
                    type="date"
                    className="form-control"
                    name="receivedDate"
                    value={formData.receivedDate}
                    onChange={handleChange}
                    required
                    min={formData.workOrderDate || undefined}
                  />
                </div>
                <div style={{ flex: "1" }}>
                  <label htmlFor="desiredCompletionDate">
                    Desired Date of Completion <span className="text-danger">*</span>
                  </label>
                  <input
                    id="desiredCompletionDate"
                    type="date"
                    className="form-control"
                    name="desiredCompletionDate"
                    value={formData.desiredCompletionDate}
                    onChange={handleChange}
                    required
                    min={formData.workOrderDate || undefined}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="document">
                  Document Upload <span className="text-danger">*</span>
                </label>
                <input
                  id="document"
                  type="file"
                  className="form-control-file"
                  name="document"
                  onChange={handleChange}
                  required
                />
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSaveDraft}
                style={{ marginRight: "10px" }}
              >
                Save as Draft
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
                disabled={isLoading || !isFormValid}
              >
                {isLoading ? "Saving..." : "Next"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default WorkOrderForm;