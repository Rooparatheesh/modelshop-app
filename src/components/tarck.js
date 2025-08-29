import React, { useState } from 'react';
import { Clock, FileText, User, Calendar, CheckCircle, Loader, Search, AlertCircle, Package, Hash, Briefcase, Flag } from 'lucide-react';
import Swal from 'sweetalert2';


const FileTrackingPage = () => {
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [controlNumber, setControlNumber] = useState('');
  const [error, setError] = useState('');
  const [jobDetails, setJobDetails] = useState(null);


  const cleanControlNumber = (number) => {
    return number.replace(/\s/g, '');
  };

  const isValidControlNumberFormat = (number) => {
    const regex = /^(\d+|\d+-\d+)$/;
    return regex.test(number);
  };

  const showAlert = (type, title, text = '') => {
    const alertStyles = {
      success: { backgroundColor: '#f0f9ff', borderColor: '#0ea5e9', color: '#0c4a6e' },
      error: { backgroundColor: '#fef2f2', borderColor: '#ef4444', color: '#991b1b' },
      warning: { backgroundColor: '#fffbeb', borderColor: '#f59e0b', color: '#92400e' }
    };
    
    const style = alertStyles[type] || alertStyles.error;
    
    // Simple alert implementation
    alert(`${title}${text ? ': ' + text : ''}`);
  };
  const handleTrack = async () => {
    // Clear previous data when starting a new search
    setTrackingData(null);
    setJobDetails(null);
  
    const cleanedControlNumber = cleanControlNumber(controlNumber);
    if (!cleanedControlNumber.trim()) {
      setError('Please enter a valid control number');
      Swal.fire('Warning', 'Please enter a control number', 'warning');
      return;
    }
  
    if (!isValidControlNumberFormat(cleanedControlNumber)) {
      setError('Invalid control number format.');
      Swal.fire(
        'Invalid Format',
        'Control number format is invalid. Please use a numeric value or hyphenated format (e.g., 10446 or 1234567-2025)',
        'error'
      );
      return;
    }
  
    setError('');
    setLoading(true);
  
    try {
      const existsResponse = await fetch(`http://10.176.21.109:4000/api/control-number-exists/${cleanedControlNumber}`);
      const existsData = await existsResponse.json();
  
      if (!existsResponse.ok || !existsData.exists) {
        setError('File not found.');
        Swal.fire('Not Found', 'Control number does not exist.', 'error');
        setTrackingData(null);
        setLoading(false);
        return;
      }
  
      const response = await fetch(`http://10.176.21.109:4000/api/job-details/${cleanedControlNumber}`);
      const data = await response.json();
  
      if (response.ok && data.success) {
        const jobDetails = Array.isArray(data.job_details)
          ? data.job_details
          : [data.job_details];
  
        if (jobDetails.length === 0) {
          setError('No job details found.');
          Swal.fire('Not Found', 'No job details found for this control number.', 'error');
          setTrackingData(null);
          setLoading(false);
          return;
        }
  
        jobDetails.sort((a, b) => {
          const dateA = a.actual_end_date || a.end_date || '';
          const dateB = b.actual_end_date || b.end_date || '';
          return dateB.localeCompare(dateA);
        });
  
        const firstJob = jobDetails[0];
        const partDetails = Array.isArray(firstJob.part_details) ? firstJob.part_details : [];
  
        const mappedData = {
          fileNumber: firstJob.control_number?.toString() || 'N/A',
          productDescription: firstJob.product_description || 'N/A',
          workOrderNumber: firstJob.work_order_number || 'N/A',
          projectCode: firstJob.project_code || 'N/A',
          groupSection: firstJob.group_section || 'N/A',
          priority: firstJob.priority || 'N/A',
          partDetails: partDetails.map((part, index) => ({
            id: index + 1,
            partNumber: part.part_number || 'N/A',
            quantity: part.quantity?.toString() || 'N/A',
            description: part.description || 'N/A',
          })),
          timeline: jobDetails.map((job, index) => ({
            id: index + 1,
            name: job.employee_name || 'Unknown',
            position: job.trade_name || 'TBD',
            status: job.status || 'Unknown',
            statusColor: getStatusBadgeColor(job.status),
            updateDate: job.actual_end_date
              ? new Date(job.actual_end_date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
              : 'N/A',
            fileReceivedDate: job.actual_start_date
              ? new Date(job.actual_start_date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
              : job.start_date
                ? new Date(job.start_date).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
                : 'N/A',
            totalTime: job.total_working_days
              ? `${job.total_working_days} day${job.total_working_days > 1 ? 's' : ''}`
              : 'N/A',
            isActive: index === 0,
            comments: job.material_detail || 'N/A',
          })),
        };
  
        setTrackingData(mappedData);
        Swal.fire('Success', `Control number ${cleanedControlNumber} is valid.`, 'success');
      } else {
        setError(data.message || 'File not found.');
        Swal.fire('Not Found', data.message || 'File not found. Please check your control number.', 'error');
        setTrackingData(null);
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      setError('Server error.');
      Swal.fire('Server Error', 'Something went wrong. Please try again later.', 'error');
      setTrackingData(null);
    } finally {
      setLoading(false);
    }
  };
  
  const getStatusBadgeColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'completed':
        return { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' };
      case 'reviewed':
        return { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fed7aa' };
      case 'initiated':
      case 'received':
        return { backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #d1d5db' };
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return { backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' };
      case 'medium':
        return { backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fed7aa' };
      case 'low':
        return { backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' };
    }
  };

  const handleKeyPress = async (e) => {
    if (e.key === 'Enter') {
      await handleTrack();
    }
  };

  return (
    <section className="content">
      <div className="content-wrapper" style={{ padding: "20px" }}>
      {/* Header */}
      <div style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: '#3b82f6', borderRadius: '8px' }}>
              <FileText style={{ width: '24px', height: '24px', color: '#ffffff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1f2937', margin: '0' }}>File Tracking System</h1>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>Track your application status in real-time</p>
            </div>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
  {/* Search Section */}
  <div style={{
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    marginBottom: '20px'
  }}>
    <h2 style={{
      fontSize: '18px',
      fontWeight: '600',
      color: '#1f2937',
      margin: '0 0 16px 0'
    }}>
      Track Your File
    </h2>

    <div style={{ display: 'flex', gap: '12px', maxWidth: '600px', flexWrap: 'wrap' }}>
      <div style={{ flex: '1', position: 'relative' }}>
        <Search style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '16px',
          height: '16px',
          color: '#9ca3af'
        }} />
        <input
          type="text"
          value={controlNumber}
          onChange={(e) => {
            const value = e.target.value;
            setControlNumber(value);

            if (value.trim() === '') {
              setJobDetails(null); // Clear job details when input is cleared
              setError(null);
            }
          }}
          onKeyPress={handleKeyPress}
          placeholder="Enter control number (e.g., 10446 or 1234567-2025)"
          style={{
            width: '100%',
            padding: '10px 10px 10px 36px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Track Button */}
      <button
        onClick={handleTrack}
        disabled={loading}
        style={{
          padding: '10px 20px',
          backgroundColor: loading ? '#9ca3af' : '#3b82f6',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap'
        }}
      >
        {loading
          ? <Loader style={{ width: '16px', height: '16px' }} />
          : <Search style={{ width: '16px', height: '16px' }} />}
        {loading ? 'Tracking...' : 'Track'}
      </button>

      
    </div>

    {/* Error Message */}
    {error && (
      <div style={{
        marginTop: '12px',
        padding: '12px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <AlertCircle style={{
          width: '16px',
          height: '16px',
          color: '#dc2626',
          flexShrink: 0
        }} />
        <p style={{ color: '#dc2626', fontSize: '14px', margin: '0' }}>{error}</p>
      </div>
    )}

    {/* Job Details Display */}
    {jobDetails && (
      <div style={{
        marginTop: '20px',
        padding: '16px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: '#f9fafb'
      }}>
        <p><strong>Control Number:</strong> {jobDetails.controlNumber}</p>
        <p><strong>Status:</strong> {jobDetails.status}</p>
        {/* Add more job details here as needed */}
      </div>
    )}
  </div>
</div>


        {/* Results */}
        {trackingData && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
            {/* File Information Sidebar */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', height: 'fit-content', position: 'sticky', top: '20px' }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ width: '48px', height: '48px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <FileText style={{ width: '24px', height: '24px', color: '#ffffff' }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: '0' }}>File Details</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>Control Number</label>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', wordBreak: 'break-all' }}>
                    {trackingData.fileNumber}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                    {trackingData.productDescription}
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                    <Hash style={{ width: '12px', height: '12px' }} />
                    Work Order
                  </label>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{trackingData.workOrderNumber}</div>
                </div>
                
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>
                    <Briefcase style={{ width: '12px', height: '12px' }} />
                    Project Code
                  </label>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{trackingData.projectCode}</div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#6b7280', marginBottom: '4px' }}>Group Section</label>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>{trackingData.groupSection}</div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>
                    <Flag style={{ width: '12px', height: '12px' }} />
                    Priority
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', ...getPriorityColor(trackingData.priority) }}>
                    {trackingData.priority}
                  </span>
                </div>
              </div>

              {/* Part Details in Sidebar */}
              {trackingData.partDetails.length > 0 && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package style={{ width: '14px', height: '14px' }} />
                    Parts ({trackingData.partDetails.length})
                  </h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {trackingData.partDetails.map((part) => (
                      <div key={part.id} style={{ padding: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '8px', fontSize: '12px' }}>
                        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '2px' }}>{part.partNumber}</div>
                        <div style={{ color: '#6b7280' }}>Qty: {part.quantity}</div>
                        {part.description !== 'N/A' && (
                          <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>{part.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Timeline Main Content */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: '0' }}>Processing Timeline</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#059669', backgroundColor: '#ecfdf5', padding: '4px 8px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
                  <CheckCircle style={{ width: '12px', height: '12px' }} />
                  Live Tracking
                </div>
              </div>
              
              <div style={{ position: 'relative' }}>
                {trackingData.timeline.map((item, index) => (
                  <div key={item.id} style={{ position: 'relative', paddingBottom: index < trackingData.timeline.length - 1 ? '24px' : '0' }}>
                    {index < trackingData.timeline.length - 1 && (
                      <div style={{ position: 'absolute', left: '20px', top: '40px', width: '2px', height: 'calc(100% - 16px)', backgroundColor: '#e5e7eb' }}></div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: item.isActive ? '#ef4444' : '#3b82f6',
                          border: '3px solid #ffffff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          <User style={{ width: '18px', height: '18px', color: '#ffffff' }} />
                        </div>
                        
                      </div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          backgroundColor: item.isActive ? '#fef2f2' : '#f8fafc',
                          border: item.isActive ? '1px solid #fecaca' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '16px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '12px' }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: '0 0 4px 0' }}>{item.name}</h4>
                              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>{item.position}</p>
                            </div>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', ...item.statusColor }}>
                              {item.status}
                            </span>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
                              <Calendar style={{ width: '14px', height: '14px' }} />
                              <span>Updated: {item.updateDate}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
                              <FileText style={{ width: '14px', height: '14px' }} />
                              <span>Received: {item.fileReceivedDate}</span>
                            </div>
                          </div>
                          
                          {item.totalTime && item.totalTime !== 'N/A' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '12px', color: '#6b7280' }}>
                              <Clock style={{ width: '14px', height: '14px', color: '#3b82f6' }} />
                              <span>Duration: <strong style={{ color: '#1f2937' }}>{item.totalTime}</strong></span>
                            </div>
                          )}
                          
                          {item.comments && item.comments !== 'N/A' && (
                            <div style={{ padding: '8px', backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0', fontStyle: 'italic' }}>"{item.comments}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}>
                <Loader style={{ width: '24px', height: '24px', color: '#ffffff' }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: '0 0 8px 0' }}>Tracking Your File</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>Please wait while we fetch the latest information...</p>
            </div>
          </div>
        )}
      </div>
      
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
    </section>
   
  );
};

export default FileTrackingPage;