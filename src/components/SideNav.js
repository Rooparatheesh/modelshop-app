import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function SideNav() {
  const [userName, setUserName] = useState('');
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedUserName = localStorage.getItem('employee_name');
    const storedMenus = localStorage.getItem('menus');

    if (storedUserName) {
      setUserName(storedUserName);
    } else {
      setError('User name not found in localStorage');
    }

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

  // Define available menu items and their routes
  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: 'fas fa-tachometer-alt' },
    { path: '/assign', name: 'Assign', icon: 'fas fa-tasks' },
    { path: '/table', name: 'Employee List', icon: 'fas fa-users' },
    { path: '/task', name: 'Work Order', icon: 'fas fa-clipboard-list' },
    { path: '/taskassign', name: 'Assign Task', icon: 'fas fa-user-check' },
    { path: '/leaverequest', name: 'Leave Request', icon: 'fas fa-calendar-alt' },
    { path: '/project', name: 'project', icon: 'fas fa-folder-open' } 
];

  const allowedMenus = [
    ...menuItems.filter(menu => menu.name === "Dashboard"),
    ...menuItems.filter(menu => menus.some(userMenu => userMenu.menu_name === menu.name)),
  ];

  return (
    <div>
    <aside className="main-sidebar sidebar-dark-primary elevation-4">
      {/* Brand Logo */}
      <button className="brand-link" style={{ background: 'none', border: 'none' }}>
        <img
          src="/dist/img/AdminLTELogo.png"
          alt="AdminLTE Logo"
          className="brand-image img-circle elevation-3"
          style={{ opacity: '.8' }}
        />
        <span className="brand-text font-weight-light">MS FLOW</span>
      </button>


        <div className="sidebar">
          {/* User Info Section */}
          <div className="user-panel mt-3 pb-3 mb-3 d-flex">
            <div className="image">
              <img
                src="/dist/img/user2-160x160.jpg"
                className="img-circle elevation-2"
                alt="User"
              />
            </div>
            <div className="info">
              {loading ? (
                <span>Loading...</span>
              ) : error ? (
                <span className="text-danger">{error}</span>
              ) : (
                <Link to="" className="d-block">{userName || 'User'}</Link>
              )}
            </div>
          </div>

          {/* Dynamic Sidebar Menu */}
          <nav className="mt-2">
            <ul className="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu" data-accordion="false">
              {allowedMenus.length > 0 ? (
                allowedMenus.map((menu) => (
                  <li key={menu.path} className="nav-item">
                    <Link to={menu.path} className="nav-link">
                      <i className={`nav-icon ${menu.icon}`} />
                      <p>{menu.name}</p>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="nav-item">
                  <p className="text-center text-warning">No menu items available</p>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </aside>
    </div>
  );
}

export default SideNav;
