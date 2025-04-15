import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Swal from "sweetalert2";


function PartsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialFormData = {
    partNumber: "",
    description: "",
    quantity: "",
  };

  const [formData, setFormData] = useState(initialFormData);
  const [parts, setParts] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const controlNumber = location.state?.formData?.controlNumber || "N/A"; // Get controlNumber or set default
 


  useEffect(() => {
    const savedParts = localStorage.getItem("parts");
    if (savedParts) {
      setParts(JSON.parse(savedParts));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("parts", JSON.stringify(parts));
  }, [parts]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddPart = () => {
    if (!formData.partNumber || !formData.description || !formData.quantity) {
      alert("All fields are required!");
      return;
    }

    if (parseInt(formData.quantity, 10) <= 0) {
      alert("Quantity must be a positive number.");
      return;
    }

    if (editIndex !== null) {
      const updatedParts = [...parts];
      updatedParts[editIndex] = formData;
      setParts(updatedParts);
      setEditIndex(null);
    } else {
      setParts([...parts, formData]);
    }

    setFormData(initialFormData);
  };

  const handleEditPart = (index) => {
    setFormData(parts[index]);
    setEditIndex(index);
  };

  const handleDeletePart = (index) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (parts.length === 0) {
      Swal.fire({
        title: "Warning",
        text: "Please add at least one part.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }
  
    const controlNumber = location.state?.formData?.controlNumber || "";
  
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/part`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ controlNumber, parts }),
      });
  
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
  
      Swal.fire({
        title: "Success!",
        text: "Parts submitted successfully!",
        icon: "success",
        confirmButtonText: "OK",
      }).then(() => {
        localStorage.removeItem("parts");
        setParts([]);
        setFormData(initialFormData);
        navigate(""); // Navigate to the next step
      });
    } catch (error) {
      console.error("Error submitting parts:", error);
  
      Swal.fire({
        title: "Error",
        text: "Failed to submit parts. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    }
  };
  return (
    <section className="content">
      <div className="content-wrapper">
        <div className="container mt-4 d-flex gap-4">
          {/* Left Side Form */}
          <div className="card p-3" style={{ width: "40%" }}>
            <h4 className="mb-3">{editIndex !== null ? "Edit Part" : "Add Part"}</h4>
               
            {/* Display Control Number */}
            <div className="mb-3">
              <strong>Control Number:</strong> {controlNumber}
            </div>

           
            <label>Part Number <span className="text-danger">*</span></label>
            <input
              type="text"
              name="partNumber"
              value={formData.partNumber}
              onChange={handleChange}
              className="form-control mb-2"
              required
            />
            <label>Description <span className="text-danger">*</span></label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control mb-2"
              required
            ></textarea>
            <label>Quantity <span className="text-danger">*</span></label>
            <input
  type=" text"
  name="quantity"
  value={formData.quantity}
  onChange={(e) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) { // Allows only numbers (0-9)
      handleChange(e);
    }
  }}
  className="form-control mb-3"
  required
/>
            <button className="btn btn-success" onClick={handleAddPart}>
              {editIndex !== null ? "Update Part" : "Add Part"}
            </button>
          </div>

          {/* Right Side Part List */}
          <div style={{ width: "55%" }}>
            {parts.map((part, index) => (
              <div key={index} className="card p-3 mb-2 d-flex flex-row justify-content-between align-items-center">
                <div>
                  <strong>Part Number:</strong> {part.partNumber} <br />
                  <strong>Description:</strong> {part.description} <br />
                  <strong>Quantity:</strong> {part.quantity}
                </div>
                <div>
                  <button className="btn btn-warning me-2" onClick={() => handleEditPart(index)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDeletePart(index)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {parts.length > 0 && (
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

export default PartsPage;
