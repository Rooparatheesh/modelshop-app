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
  const [isLoading, setIsLoading] = useState(false);
  const controlNumber =
    location.state?.formData?.controlNumber || localStorage.getItem("lastControlNumber") || null;

  useEffect(() => {
    if (!controlNumber) {
      Swal.fire({
        title: "Error",
        text: "No work order data found. Please create a work order first.",
        icon: "error",
        confirmButtonText: "OK",
      }).then(() => {
        navigate("/task");
      });
    }
  }, [controlNumber, navigate]);

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
      Swal.fire({
        title: "Warning",
        text: "All fields are required!",
        icon: "warning",
        confirmButtonText: "OK",
      });
      return;
    }

    const quantity = parseInt(formData.quantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      Swal.fire({
        title: "Warning",
        text: "Quantity must be a positive number.",
        icon: "warning",
        confirmButtonText: "OK",
      });
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
    if (isLoading) return;
    setIsLoading(true);

    if (parts.length === 0) {
      Swal.fire({
        title: "Warning",
        text: "Please add at least one part.",
        icon: "warning",
        confirmButtonText: "OK",
      });
      setIsLoading(false);
      return;
    }

    if (!controlNumber) {
      Swal.fire({
        title: "Error",
        text: "Control Number is missing. Please create a work order first.",
        icon: "error",
        confirmButtonText: "OK",
      });
      setIsLoading(false);
      return;
    }

    try {
      const headers = {
        "Content-Type": "application/json",
      };

      console.log("Submitting parts with headers:", headers, "body:", { controlNumber, parts });

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/part`, {
        method: "POST",
        headers,
        body: JSON.stringify({ controlNumber, parts }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log("Parts submission response:", responseData);

      localStorage.removeItem("parts");
      localStorage.removeItem("lastControlNumber");
      setParts([]);
      setFormData(initialFormData);

      // await Swal.fire({
      //   title: "Success!",
      //   text: "Parts submitted successfully! Redirecting to Work Order Form...",
      //   icon: "success",
      //   confirmButtonText: "OK",
      //   timer: 1500,
      // });

      console.log("Navigating to /work-order");
      navigate("/task", { state: { fromSubmission: true } });
    } catch (error) {
      console.error("Error submitting parts:", error);
      Swal.fire({
        title: "Error",
        text: error.message || "Failed to submit parts. Please try again.",
        icon: "error",
        confirmButtonText: "OK",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="content">
      <div className="content-wrapper">
        <div className="container mt-4 d-flex gap-4">
          <div className="card p-3" style={{ width: "40%" }}>
            <h4 className="mb-3">{editIndex !== null ? "Edit Part" : "Add Part"}</h4>
            <div className="mb-3">
              <strong>Control Number:</strong> {controlNumber || "N/A"}
            </div>
            <label>
              Part Number <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              name="partNumber"
              value={formData.partNumber}
              onChange={handleChange}
              className="form-control mb-2"
              required
            />
            <label>
              Description <span className="text-danger">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-control mb-2"
              required
            ></textarea>
            <label>
              Quantity <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className="form-control mb-3"
              required
              min="1"
            />
            <button className="btn btn-success" onClick={handleAddPart}>
              {editIndex !== null ? "Update Part" : "Add Part"}
            </button>
          </div>

          <div style={{ width: "55%" }}>
            {parts.map((part, index) => (
              <div
                key={index}
                className="card p-3 mb-2 d-flex flex-row justify-content-between align-items-center"
              >
                <div>
                  <strong>Part Number:</strong> {part.partNumber} <br />
                  <strong>Description:</strong> {part.description} <br />
                  <strong>Quantity:</strong> {part.quantity}
                </div>
                <div>
                  <button
                    className="btn btn-warning me-2"
                    onClick={() => handleEditPart(index)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeletePart(index)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {parts.length > 0 && (
              <div className="mt-3 float-end">
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? "Submitting..." : "Submit"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default PartsPage;