import React, { useState } from "react";
import { FileText, Package, CheckCircle, Plus, Trash2, Upload, File, X } from "lucide-react";

const WorkOrderForms = () => {
  const [formData, setFormData] = useState({
    workOrderNumber: "",
    date: "",
    previousWorkOrderRef: "",
    receivingDept: "",
    projectEndDate: "",
    priority: "",
    materialOnlyRequest: "",
    desiredCompletionDate: "",
    issuingGroup: "",
    projectCode: "",
    productDescription: "",
    parts: [
      {
        id: Date.now().toString(),
        partNumber: "",
        drawingTitleDescription: "",
        quantity: "",
        remarks: "",
        drawingFiles: [],
      },
    ],
    slNo: "",
    dprNumbers: "",
    description: "",
    remarks: "",
    issuedBy: "",
    section: "",
    workCompletedBy: "",
    recommendedBy: "",
    verifiedBy: "",
    approvedBy: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePartChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      parts: prev.parts.map((part, i) =>
        i === index ? { ...part, [field]: value } : part
      ),
    }));
  };

  const addPart = () => {
    setFormData((prev) => ({
      ...prev,
      parts: [
        ...prev.parts,
        {
          id: Date.now().toString(),
          partNumber: "",
          drawingTitleDescription: "",
          quantity: "",
          remarks: "",
          drawingFiles: [],
        },
      ],
    }));
  };

  const removePart = (index) => {
    if (formData.parts.length > 1) {
      setFormData((prev) => ({
        ...prev,
        parts: prev.parts.filter((_, i) => i !== index),
      }));
    }
  };

  const handleFileUpload = (index, files) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      const validTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/pdf",
        "image/tiff",
        "application/vnd.ms-excel",
        "text/csv",
      ];
      const validExtensions = [".dwg", ".dxf", ".step", ".stp", ".igs", ".iges"];
      const hasValidExtension = validExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );
      return validTypes.includes(file.type) || hasValidExtension;
    });

    if (validFiles.length !== fileArray.length) {
      alert("Some files were not uploaded. Please upload only drawing files (PDF, images, DWG, DXF, STEP, etc.)");
    }

    setFormData((prev) => ({
      ...prev,
      parts: prev.parts.map((part, i) =>
        i === index
          ? { ...part, drawingFiles: [...(part.drawingFiles || []), ...validFiles] }
          : part
      ),
    }));
  };

  const removeFile = (partIndex, fileIndex) => {
    setFormData((prev) => ({
      ...prev,
      parts: prev.parts.map((part, i) =>
        i === partIndex
          ? {
              ...part,
              drawingFiles: part.drawingFiles.filter((_, fi) => fi !== fileIndex),
            }
          : part
      ),
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleSubmit = async () => {
    const requiredFields = [
      "workOrderNumber",
      "date",
      "receivingDept",
      "issuingGroup",
      "projectCode",
      "productDescription",
    ];
    const missingFields = requiredFields.filter((field) => !formData[field].trim());

    const invalidParts = formData.parts.some(
      (part) => !part.partNumber.trim() || !part.drawingTitleDescription.trim()
    );

    if (missingFields.length > 0) {
      alert(`Please fill in all required fields: ${missingFields.join(", ")}`);
      return;
    }

    if (invalidParts) {
      alert("Please fill in Part Number and Drawing Title/Description for all parts");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      console.log("Submitted Data:", formData);
      alert("Work order submitted successfully!");
      setIsSubmitting(false);
    }, 1000);
  };

  const styles = {
    container: {
      minHeight: "100vh",
      backgroundColor: "#f8fafc",
      padding: "32px 16px",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    maxWidth: {
      maxWidth: "1024px",
      margin: "0 auto",
    },
    header: {
      textAlign: "center",
      marginBottom: "32px",
    },
    headerIcon: {
      display: "flex",
      justifyContent: "center",
      marginBottom: "16px",
    },
    iconCircle: {
      backgroundColor: "#2563eb",
      padding: "12px",
      borderRadius: "50%",
    },
    title: {
      fontSize: "30px",
      fontWeight: "bold",
      color: "#1f2937",
      marginBottom: "8px",
    },
    subtitle: {
      color: "#6b7280",
    },
    section: {
      backgroundColor: "white",
      borderRadius: "8px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      border: "1px solid #e5e7eb",
      padding: "24px",
      marginBottom: "24px",
    },
    sectionHeader: {
      display: "flex",
      alignItems: "center",
      marginBottom: "16px",
    },
    sectionTitle: {
      fontSize: "18px",
      fontWeight: "600",
      color: "#1f2937",
      marginLeft: "8px",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: "16px",
    },
    gridFull: {
      gridColumn: "1 / -1",
    },
    inputGroup: {
      display: "flex",
      flexDirection: "column",
    },
    label: {
      fontSize: "14px",
      fontWeight: "500",
      color: "#374151",
      marginBottom: "4px",
    },
    required: {
      color: "#ef4444",
      marginLeft: "4px",
    },
    inputBox: {
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      fontSize: "14px",
      transition: "border-color 0.2s",
      outline: "none",
      backgroundColor: "white",
      width: "100%",
      boxSizing: "border-box",
    },
    select: {
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      fontSize: "14px",
      transition: "border-color 0.2s",
      outline: "none",
      backgroundColor: "white",
      width: "100%",
      boxSizing: "border-box",
    },
    inputFocus: {
      borderColor: "#3b82f6",
      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
    },
    textarea: {
      padding: "8px 12px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      fontSize: "14px",
      transition: "border-color 0.2s",
      outline: "none",
      resize: "vertical",
      minHeight: "80px",
      backgroundColor: "white",
      width: "100%",
      boxSizing: "border-box",
    },
    partCard: {
      backgroundColor: "#f9fafb",
      padding: "16px",
      borderRadius: "8px",
      marginBottom: "16px",
      border: "1px solid #e5e7eb",
    },
    partHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    },
    partTitle: {
      fontWeight: "500",
      color: "#374151",
    },
    deleteButton: {
      color: "#ef4444",
      background: "none",
      border: "none",
      padding: "4px",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "color 0.2s",
    },
    uploadArea: {
      width: "100%",
      backgroundColor: "white",
      border: "2px dashed #d1d5db",
      borderRadius: "8px",
      padding: "16px",
      cursor: "pointer",
      transition: "all 0.2s",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      color: "#6b7280",
    },
    uploadAreaHover: {
      borderColor: "#60a5fa",
      color: "#2563eb",
    },
    fileList: {
      marginTop: "12px",
    },
    fileItem: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "white",
      border: "1px solid #e5e7eb",
      borderRadius: "6px",
      padding: "8px",
      marginBottom: "8px",
    },
    fileInfo: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    fileName: {
      fontSize: "14px",
      fontWeight: "500",
      color: "#374151",
      maxWidth: "200px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    fileSize: {
      fontSize: "12px",
      color: "#6b7280",
    },
    addButton: {
      width: "100%",
      backgroundColor: "#eff6ff",
      color: "#2563eb",
      fontWeight: "500",
      padding: "8px 16px",
      borderRadius: "6px",
      border: "1px solid #bfdbfe",
      cursor: "pointer",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
    submitContainer: {
      display: "flex",
      justifyContent: "center",
      paddingTop: "24px",
    },
    submitButton: {
      backgroundColor: "#2563eb",
      color: "white",
      fontWeight: "600",
      padding: "12px 32px",
      borderRadius: "6px",
      border: "none",
      cursor: "pointer",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    },
    submitButtonDisabled: {
      backgroundColor: "#93c5fd",
      cursor: "not-allowed",
    },
    spinner: {
      width: "20px",
      height: "20px",
      border: "2px solid transparent",
      borderTop: "2px solid white",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
    },
  };

  const InputField = React.memo(({ label, name, type = "text", required = false, placeholder, style = {} }) => (
    <div style={{ ...styles.inputGroup, ...style }}>
      <label style={styles.label}>
        {label}
        {required && <span style={styles.required}>*</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          name={name}
          value={formData[name] || ""}
          onChange={handleChange}
          required={required}
          placeholder={placeholder}
          style={styles.textarea}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={formData[name] || ""}
          onChange={handleChange}
          required={required}
          placeholder={placeholder}
          style={styles.inputBox}
        />
      )}
    </div>
  ));

  const SelectField = React.memo(({ label, name, options, required = false, placeholder, style = {} }) => (
    <div style={{ ...styles.inputGroup, ...style }}>
      <label style={styles.label}>
        {label}
        {required && <span style={styles.required}>*</span>}
      </label>
      <select
        name={name}
        value={formData[name] || ""}
        onChange={handleChange}
        required={required}
        style={styles.select}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  ));

  return (
    <div style={styles.container}>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div style={styles.maxWidth}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>
            <div style={styles.iconCircle}>
              <FileText size={32} color="white" />
            </div>
          </div>
          <h1 style={styles.title}>Work Order Form</h1>
          <p style={styles.subtitle}>Fill out the details below to create a new work order</p>
        </div>
        <div style={{ marginBottom: "24px" }}>
        <div style={styles.section}>
  <div style={styles.sectionHeader}>
    <Package size={20} color="#2563eb" />
    <h3 style={styles.sectionTitle}>Project Information</h3>
  </div>
  <div style={styles.grid}>
    <InputField
      label="Work Order Number"
      name="workOrderNumber"
      value={formData.workOrderNumber}
      onChange={handleChange}
      required
      placeholder="Enter work order number"
    />
    <InputField
      label="Date"
      name="date"
      type="date"
      value={formData.date}
      onChange={handleChange}
      required
    />
    <InputField
      label="Previous Work Order Reference"
      name="previousWorkOrderRef"
      value={formData.previousWorkOrderRef}
      onChange={handleChange}
      placeholder="Enter previous work order reference"
    />
    <InputField
      label="Receiving Department"
      name="receivingDept"
      value={formData.receivingDept}
      onChange={handleChange}
      required
      placeholder="Enter receiving department"
    />
    <InputField
      label="Project End Date"
      name="projectEndDate"
      type="date"
      value={formData.projectEndDate}
      onChange={handleChange}
      placeholder="Select project end date"
    />
    <SelectField
      label="Priority"
      name="priority"
      value={formData.priority}
      onChange={handleChange}
      options={[
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
      ]}
      placeholder="Select priority level"
    />
    <SelectField
      label="Material Only Request"
      name="materialOnlyRequest"
      value={formData.materialOnlyRequest}
      onChange={handleChange}
      options={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ]}
      placeholder="Select Yes or No"
    />
    <InputField
      label="Desired Completion Date"
      name="desiredCompletionDate"
      type="date"
      value={formData.desiredCompletionDate}
      onChange={handleChange}
      placeholder="Select desired completion date"
    />
    <InputField
      label="Issuing Group/Department"
      name="issuingGroup"
      value={formData.issuingGroup}
      onChange={handleChange}
      required
      placeholder="Enter issuing group or department"
    />
    <InputField
      label="Project Code"
      name="projectCode"
      value={formData.projectCode}
      onChange={handleChange}
      required
      placeholder="Enter project code"
    />
    <InputField
      label="Product Description"
      name="productDescription"
      value={formData.productDescription}
      onChange={handleChange}
      required
      placeholder="Enter product description"
      style={styles.gridFull}
    />
  </div>
</div>


          {/* Parts & Materials */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <Package size={20} color="#2563eb" />
              <h3 style={styles.sectionTitle}>Parts & Materials</h3>
            </div>
            <div style={styles.gridFull}>
              {formData.parts.map((part, index) => (
                <div key={part.id} style={styles.partCard}>
                  <div style={styles.partHeader}>
                    <h4 style={styles.partTitle}>Part {index + 1}</h4>
                    {formData.parts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePart(index)}
                        style={styles.deleteButton}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div style={styles.grid}>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>
                        Part Number <span style={styles.required}>*</span>
                      </label>
                      <input
                        type="text"
                        value={part.partNumber}
                        onChange={(e) => handlePartChange(index, "partNumber", e.target.value)}
                        placeholder="Enter part number"
                        style={styles.inputBox}
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>
                        Drawing Title/Description <span style={styles.required}>*</span>
                      </label>
                      <input
                        type="text"
                        value={part.drawingTitleDescription}
                        onChange={(e) =>
                          handlePartChange(index, "drawingTitleDescription", e.target.value)
                        }
                        placeholder="Enter drawing title or description"
                        style={styles.inputBox}
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Quantity</label>
                      <input
                        type="number"
                        value={part.quantity}
                        onChange={(e) => handlePartChange(index, "quantity", e.target.value)}
                        placeholder="Enter quantity"
                        style={styles.inputBox}
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.label}>Remarks</label>
                      <input
                        type="text"
                        value={part.remarks}
                        onChange={(e) => handlePartChange(index, "remarks", e.target.value)}
                        placeholder="Enter remarks (optional)"
                        style={styles.inputBox}
                      />
                    </div>
                  </div>

                  {/* Drawing Upload Section */}
                  <div style={{ ...styles.inputGroup, ...styles.gridFull }}>
                    <label style={styles.label}>Drawing Files</label>
                    <div
                      style={styles.uploadArea}
                      onClick={() => document.getElementById(`file-input-${index}`).click()}
                    >
                      <Upload size={24} />
                      <p style={{ margin: "8px 0 4px 0", fontWeight: "500" }}>
                        Click to upload drawing files
                      </p>
                      <p style={{ margin: "0", fontSize: "12px" }}>
                        PDF, Images, DWG, DXF, STEP, IGES files supported
                      </p>
                      <input
                        id={`file-input-${index}`}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.gif,.tiff,.dwg,.dxf,.step,.stp,.igs,.iges,.xls,.xlsx,.csv"
                        onChange={(e) => handleFileUpload(index, e.target.files)}
                        style={{ display: "none" }}
                      />
                    </div>

                    {/* Display uploaded files */}
                    {part.drawingFiles && part.drawingFiles.length > 0 && (
                      <div style={styles.fileList}>
                        {part.drawingFiles.map((file, fileIndex) => (
                          <div key={fileIndex} style={styles.fileItem}>
                            <div style={styles.fileInfo}>
                              <File size={16} color="#6b7280" />
                              <div>
                                <div style={styles.fileName}>{file.name}</div>
                                <div style={styles.fileSize}>{formatFileSize(file.size)}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index, fileIndex)}
                              style={{
                                ...styles.deleteButton,
                                padding: "4px",
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button type="button" onClick={addPart} style={styles.addButton}>
                <Plus size={16} />
                <span>Add Another Part</span>
              </button>
            </div>
          </div>

          
          {/* Submit Button */}
          <div style={styles.submitContainer}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                ...styles.submitButton,
                ...(isSubmitting ? styles.submitButtonDisabled : {}),
              }}
            >
              {isSubmitting ? (
                <>
                  <div style={styles.spinner}></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  <span>Submit Work Order</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(WorkOrderForms);