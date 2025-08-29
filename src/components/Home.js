import React, { Component } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default class Home extends Component {
  state = {
    employeeCount: 0,
    userRegistrations: 0,
    completedTaskCount: 0,
    loading: true,
    error: null,
  };

  componentDidMount() {
    const baseUrl = process.env.REACT_APP_API_URL;

    Promise.all([
      axios.get(`${baseUrl}/api/employee_count`),
      axios.get(`${baseUrl}/api/completed_task_count`)
    ])
      .then(([employeeRes, taskRes]) => {
        this.setState({
          employeeCount: employeeRes.data.total_employees,
          completedTaskCount: taskRes.data.completedCount,
          loading: false,
        });
      })
      .catch((error) => {
        this.setState({ error: error.message, loading: false });
      });
  }

  // Generate chart data based on your API data
  getChartData = () => {
    const { employeeCount, completedTaskCount } = this.state;
    
    // Sample data structure - you can modify this based on your actual API responses
    const overviewData = [
      { name: 'Employees', value: employeeCount, color: '#17a2b8' },
      { name: 'Completed Tasks', value: completedTaskCount, color: '#28a745' },
      { name: 'User Registrations', value: 44, color: '#ffc107' },
      { name: 'Unique Visitors', value: 65, color: '#dc3545' }
    ];
    const trendData = [
      { month: 'Jan', employees: Math.max(employeeCount - 55, 0), tasks: Math.max(completedTaskCount - 70, 0) },
      { month: 'Feb', employees: Math.max(employeeCount - 45, 0), tasks: Math.max(completedTaskCount - 60, 0) },
      { month: 'Mar', employees: Math.max(employeeCount - 35, 0), tasks: Math.max(completedTaskCount - 50, 0) },
      { month: 'Apr', employees: Math.max(employeeCount - 25, 0), tasks: Math.max(completedTaskCount - 40, 0) },
      { month: 'May', employees: Math.max(employeeCount - 15, 0), tasks: Math.max(completedTaskCount - 30, 0) },
      { month: 'Jun', employees: Math.max(employeeCount - 10, 0), tasks: Math.max(completedTaskCount - 20, 0) },
      { month: 'Jul', employees: Math.max(employeeCount - 5, 0), tasks: Math.max(completedTaskCount - 10, 0) },
      { month: 'Aug', employees: employeeCount, tasks: completedTaskCount },
      { month: 'Sep', employees: employeeCount, tasks: completedTaskCount },
      { month: 'Oct', employees: employeeCount, tasks: completedTaskCount },
      { month: 'Nov', employees: employeeCount, tasks: completedTaskCount },
      { month: 'Dec', employees: employeeCount, tasks: completedTaskCount },
    ];
    
    return { overviewData, trendData };
  };

  render() {
    const { employeeCount, completedTaskCount, loading, error } = this.state;
    const { overviewData, trendData } = this.getChartData();

    return (
      <div>
        <div className="content-wrapper">
          <div className="content-header">
            <div className="container-fluid">
              <div className="row mb-2">
                <div className="col-sm-6">
                  <h1 className="m-0 text-dark">Dashboard</h1>
                </div>
                <div className="col-sm-6">
                  <ol className="breadcrumb float-sm-right">
                    <li className="breadcrumb-item">
                      <a href="/">Home</a>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <section className="content">
            <div className="container-fluid">
              {/* Original Stats Cards */}
              <div className="row">
                <div className="col-lg-3 col-6">
                  <div className="small-box bg-info">
                    <div className="inner">
                      {loading ? (
                        <h3>Loading...</h3>
                      ) : error ? (
                        <h3>Error: {error}</h3>
                      ) : (
                        <h3>{employeeCount}</h3>
                      )}
                      <p>Total Employees</p>
                    </div>
                    <div className="icon" aria-hidden="true">
                      <i className="ion ion-person" />
                    </div>
                    <a href="/table" className="small-box-footer">
                      More info <i className="fas fa-arrow-circle-right" aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <div className="col-lg-3 col-6">
                  <div className="small-box bg-success">
                    <div className="inner">
                      {loading ? (
                        <h3>Loading...</h3>
                      ) : error ? (
                        <h3>Error: {error}</h3>
                      ) : (
                        <h3>{completedTaskCount}</h3>
                      )}
                      <p>Completed Tasks</p>
                    </div>
                    <div className="icon" aria-hidden="true">
                      <i className="ion ion-checkmark-circle" />
                    </div>
                    <a href="#" className="small-box-footer">
                      More info <i className="fas fa-arrow-circle-right" aria-hidden="true" />
                    </a>
                  </div>
                </div>

                <div className="col-lg-3 col-6">
                  <div className="small-box bg-warning">
                    <div className="inner">
                      <h3>44</h3>
                      <p>User Registrations</p>
                    </div>
                    <div className="icon">
                      <i className="ion ion-person-add" />
                    </div>
                    <a href="#" className="small-box-footer">
                      More info <i className="fas fa-arrow-circle-right" />
                    </a>
                  </div>
                </div>

                <div className="col-lg-3 col-6">
                  <div className="small-box bg-danger">
                    <div className="inner">
                      <h3>65</h3>
                      <p>Unique Visitors</p>
                    </div>
                    <div className="icon" aria-hidden="true">
                      <i className="ion ion-pie-graph" />
                    </div>
                    <a href="/visitors" className="small-box-footer">
                      More info <i className="fas fa-arrow-circle-right" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>

              {/* New Charts Section */}
              {!loading && !error && (
                <div className="row mt-4">
                  {/* Overview Pie Chart */}
                  <div className="col-lg-6">
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">
                          <i className="fas fa-chart-pie mr-1"></i>
                          Overview Distribution
                        </h3>
                      </div>
                      <div className="card-body">
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={overviewData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {overviewData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Trend Line Chart */}
                  <div className="col-lg-6">
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">
                          <i className="fas fa-chart-line mr-1"></i>
                          Monthly Trends
                        </h3>
                      </div>
                      <div className="card-body">
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="employees"
                              stroke="#17a2b8"
                              strokeWidth={2}
                              name="Employees"
                            />
                            <Line
                              type="monotone"
                              dataKey="tasks"
                              stroke="#28a745"
                              strokeWidth={2}
                              name="Completed Tasks"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!loading && !error && (
                <div className="row mt-4">
                  {/* Bar Chart */}
                  <div className="col-lg-8">
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">
                          <i className="fas fa-chart-bar mr-1"></i>
                          Performance Metrics
                        </h3>
                      </div>
                      <div className="card-body">
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart data={overviewData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8884d8">
                              {overviewData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Area Chart */}
                  <div className="col-lg-4">
                    <div className="card">
                      <div className="card-header">
                        <h3 className="card-title">
                          <i className="fas fa-chart-area mr-1"></i>
                          Growth Area
                        </h3>
                      </div>
                      <div className="card-body">
                        <ResponsiveContainer width="100%" height={350}>
                          <AreaChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Area
                              type="monotone"
                              dataKey="employees"
                              stackId="1"
                              stroke="#17a2b8"
                              fill="#17a2b8"
                              fillOpacity={0.6}
                            />
                            <Area
                              type="monotone"
                              dataKey="tasks"
                              stackId="1"
                              stroke="#28a745"
                              fill="#28a745"
                              fillOpacity={0.6}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="row"></div>
            </div>
          </section>
        </div>
      </div>
    );
  }
}