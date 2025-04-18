import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

function WorkOrderForm() {
  const [formData, setFormData] = useState({
    workOrderNumber: "",
    controlNumber: "", // Initially empty
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

  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem("workOrderDraft");
    // Fetch the next available control number when the form is loaded
    const fetchNextControlNumber = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/next-control-number`);
        const data = await response.json();
        
        // Set the initial control number to `1` or the number fetched from backend
        setFormData((prev) => ({
          ...prev,
          controlNumber: data.nextControlNumber, // This will initially be `1`
        }));
      } catch (err) {
        console.error("Error fetching next control number:", err);
        alert("Failed to fetch the next control number.");
      }
    };

    fetchNextControlNumber();
  }, []); // This only runs once when the component mounts


  useEffect(() => {
    const savedDraft = localStorage.getItem("workOrderDraft");
    if (savedDraft) {
      setFormData(JSON.parse(savedDraft));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData({
      ...formData,
      [name]: type === "file" ? files[0] : value,
    });
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
    const formDataToSend = new FormData();

    // Append all form fields to FormData except controlNumber (which is auto-generated)
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "controlNumber") return; // Skip controlNumber (auto-generated)
      if (key === "document" && value) {
        formDataToSend.append("document", value);
      } else {
        formDataToSend.append(key, value);
      }
    });

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/work-order`, {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) throw new Error("Failed to save work order");

      const data = await response.json();
      // After saving, data.controlNumber should reflect the inserted control number (e.g., `1`)
      const savedFormData = { ...formData, controlNumber: data.controlNumber }; // Backend control number response

      // Reset the form state (excluding the controlNumber)
      setFormData({
        workOrderNumber: "",
        controlNumber: "", // Reset controlNumber after submission
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

      // Optionally clear draft from localStorage
      try {
        localStorage.removeItem("workOrderDraft");
      } catch (err) {
        console.warn("Failed to clear draft:", err);
      }

      // Navigate to the next page, passing updated form data (including the generated controlNumber)
      navigate("/part", { state: { formData: savedFormData } });
    } catch (error) {
      console.error("Error saving work order:", error);
      alert("Error saving work order. Please try again.");
    }
  };
  
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
                  <label>
                    Work Order Number <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="workOrderNumber"
                    value={formData.workOrderNumber}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div style={{ flex: "1" }}>
                <label>
  Control Number <span className="text-danger">*</span>
</label>
<input
  type="text"
  className="form-control"
  name="controlNumber"
  value={formData.controlNumber || ''} // Display updated control number
  readOnly
/>



                </div>
              </div>

              <div className="form-group" style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: "1" }}>
                  <label>
                    Project Code <span className="text-danger">*</span>
                  </label>
                  <input
  type="text"
  className="form-control"
  name="projectCode"
  value={formData.projectCode}
  onChange={(e) => {
    const value = e.target.value;
    if (/^[A-Za-z0-9\s]*$/.test(value)) { // Allows alphabets, numbers, and spaces
      handleChange(e);
    }
  }}
  required
/>



                </div>
                <div style={{ flex: "1" }}>
                  <label>
                    Group / Section <span className="text-danger">*</span>
                  </label>
                  <input
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
                  <label>
                    Priority <span className="text-danger">*</span>
                  </label>
                  <select
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
                  <label>
                    Product Description <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="productDescription"
                    value={formData.productDescription}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[A-Za-z\s]*$/.test(value)) { // Allows alphabets and spaces
                        handleChange(e);
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: "1" }}>
                  <label>
                    Work Order Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    name="workOrderDate"
                    value={formData.workOrderDate}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div style={{ flex: "1" }}>
                  <label>
                    Received Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    name="receivedDate"
                    value={formData.receivedDate}
                    onChange={handleChange}
                    required
                  />
                </div>
             

              <div style={{ flex: "1" }}>
                <label>
                  Desired Date of Completion <span className="text-danger">*</span>
                </label>
                <input
                  type="date"
                  className="form-control"
                  name="desiredCompletionDate"
                  value={formData.desiredCompletionDate}
                  onChange={handleChange}
                  required
                />
              </div>
              </div>

              <div className="form-group">
                <label>
                  Document Upload <span className="text-danger">*</span>
                </label>
                <input
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

              <button type="button" className="btn btn-primary" onClick={handleNext}>
                Next
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

export default WorkOrderForm;
