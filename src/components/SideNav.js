import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function SideNav() {
  const [userName, setUserName] = useState('');
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const storedUserName = localStorage.getItem('employee_name');
    const storedMenus = localStorage.getItem('menus');

    // Set user name
    if (storedUserName) {
      setUserName(storedUserName);
    } else {
      setError('User name not found');
    }

    // Parse and validate menus
    try {
      const parsedMenus = storedMenus ? JSON.parse(storedMenus) : [];
      if (Array.isArray(parsedMenus)) {
        setMenus(parsedMenus);
      } else {
        throw new Error('Invalid menu format');
      }
    } catch (error) {
      console.error("Error parsing menus from localStorage", error);
      setMenus([]);
      setError('Error loading menu permissions');
    }

    setLoading(false);
  }, []);

 // Menu items with better icons and organization
const menuItems = [
  { path: '/dashboard', name: 'Dashboard', icon: 'fas fa-chart-pie', category: 'main' },
  { path: '/assign', name: 'Assign', icon: 'fas fa-user-plus', category: 'management' },
  { path: '/table', name: 'Employee List', icon: 'fas fa-users', category: 'management' },
  { path: '/task', name: 'Work Order', icon: 'fas fa-clipboard-check', category: 'tasks' },
  { path: '/taskassign', name: 'Assign Task', icon: 'fas fa-tasks', category: 'tasks' },
  { path: '/FileTrackingPage', name: 'Track', icon: 'fas fa-map-marker-alt', category: 'tasks' },
  { path: '/leaverequest', name: 'Leave Request', icon: 'fas fa-calendar-minus', category: 'hr' },
  { path: '/project', name: 'project', icon: 'fas fa-project-diagram', category: 'projects' },
  { path: '/ReportGeneration', name: 'ReportGeneration', icon: 'fas fa-chart-bar', category: 'reports' },
 //{ path: '/WorkOrderForms', name: 'Work Order', icon: 'fas fa-chart-bar', category: 'task' },
  
  
];
  const allowedMenus = [
  ...menuItems.filter(menu => 
    menu.name === "Dashboard" || 
    menus.some(userMenu => userMenu.menu_name.toLowerCase() === menu.name.toLowerCase())
  ),
];

  

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      main: 'Overview',
      management: 'Management',
      tasks: 'Task Management',
      hr: 'Human Resources',
      projects: 'Projects',
      reports: 'Analytics',
    };
    return labels[category] || category;
  };

  // Group menus by category
  const groupedMenus = allowedMenus.reduce((acc, menu) => {
    const category = menu.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(menu);
    return acc;
  }, {});

  return (
    <div>
      <aside className={`main-sidebar sidebar-dark-primary elevation-4 ${isCollapsed ? 'sidebar-collapse' : ''}`}>
        {/* Brand Logo */}
        <div className="brand-link d-flex align-items-center justify-content-between" style={{ padding: '0.8rem 1rem' }}>
          <div className="d-flex align-items-center">
            <img
              src="/dist/img/AdminLTELogo.png"
              alt="MS FLOW Logo"
              className="brand-image"
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            />
            {!isCollapsed && (
              <span className="brand-text font-weight-bold ml-2" style={{ fontSize: '1.1rem' }}>
                MS FLOW
              </span>
            )}
          </div>
          <button 
            onClick={toggleSidebar}
            className="btn btn-sm btn-outline-light"
            style={{ border: 'none', background: 'transparent' }}
          >
            <i className={`fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>

        <div className="sidebar">
          {/* User Info Section */}
          <div className="user-panel mt-3 pb-3 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="d-flex align-items-center">
              <div className="image position-relative">
                <img
                  src="/dist/img/user2-160x160.jpg"
                  className="img-circle elevation-2"
                  alt="User"
                  style={{ width: '45px', height: '45px' }}
                />
                <div className="online-indicator" style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#28a745',
                  borderRadius: '50%',
                  border: '2px solid #fff',
                }}></div>
              </div>
              {!isCollapsed && (
                <div className="info ml-3">
                  {loading ? (
                    <div className="d-flex align-items-center">
                      <div className="spinner-border spinner-border-sm text-light mr-2" role="status"></div>
                      <span className="text-light">Loading...</span>
                    </div>
                  ) : error ? (
                    <span className="text-warning small">{error}</span>
                  ) : (
                    <div>
                      <Link to="/profile" className="d-block text-light font-weight-medium">
                        {userName || 'User'}
                      </Link>
                      <small className="text-muted">Online</small>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Sidebar Menu */}
          <nav className="mt-2">
            <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="false">
              {Object.keys(groupedMenus).length > 0 ? (
                Object.entries(groupedMenus).map(([category, categoryMenus]) => (
                  <div key={category}>
                    {!isCollapsed && categoryMenus.length > 1 && (
                      <li className="nav-header text-uppercase" style={{ 
                        fontSize: '0.7rem', 
                        fontWeight: 'bold',
                        color: 'rgba(255,255,255,0.5)',
                        letterSpacing: '0.5px',
                        marginTop: category === 'main' ? '0' : '1rem',
                      }}>
                        {getCategoryLabel(category)}
                      </li>
                    )}
                    {categoryMenus.map((menu) => (
                      <li key={menu.path} className="nav-item">
                        <Link 
                          to={menu.path} 
                          className={`nav-link d-flex align-items-center ${isActiveRoute(menu.path) ? 'active' : ''}`}
                          style={{
                            borderRadius: '8px',
                            margin: '2px 8px',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                          }}
                        >
                          <i 
                            className={`nav-icon ${menu.icon}`} 
                            style={{ 
                              width: '20px', 
                              textAlign: 'center',
                              fontSize: '1rem',
                            }}
                          />
                          {!isCollapsed && (
                            <p className="mb-0 ml-3" style={{ fontSize: '0.9rem' }}>
                              {menu.name}
                            </p>
                          )}
                          {isActiveRoute(menu.path) && (
                            <div style={{
                              position: 'absolute',
                              right: '8px',
                              width: '4px',
                              height: '20px',
                              backgroundColor: '#007bff',
                              borderRadius: '2px',
                            }}></div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </div>
                ))
              ) : (
                <li className="nav-item">
                  <div className="text-center py-4">
                    <i className="fas fa-exclamation-triangle text-warning mb-2" style={{ fontSize: '2rem' }}></i>
                    {!isCollapsed && (
                      <p className="text-warning small mb-0">No menu items available</p>
                    )}
                  </div>
                </li>
              )}
            </ul>
          </nav>

          {/* Quick Actions Footer
          {!isCollapsed && (
            <div className="mt-auto p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="d-flex justify-content-around">
                <button className="btn btn-outline-light btn-sm" title="Settings">
                  <i className="fas fa-cog"></i>
                </button>
                <button className="btn btn-outline-light btn-sm" title="Help">
                  <i className="fas fa-question-circle"></i>
                </button>
              </div>
            </div>
          )} */}
        </div>
      </aside>

      {/* Custom Styles */}
      <style>{`
        .nav-link:hover {
          background-color: rgba(255,255,255,0.1) !important;
          transform: translateX(3px);
        }
        
        .nav-link.active {
          background-color: rgba(0,123,255,0.2) !important;
          color: #007bff !important;
        }
        
        .sidebar-collapse .brand-text {
          display: none;
        }
        
        .online-indicator {
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        
        .spinner-border-sm {
          width: 1rem;
          height: 1rem;
        }
      `}</style>
    </div>
  );
}

export default SideNav;