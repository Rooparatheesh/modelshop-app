document.addEventListener('DOMContentLoaded', () => {
    // View Employee Modal: Populate the fields with the values passed from the button
    var viewEmployeeModal = document.getElementById('viewEmployeeModal');
    viewEmployeeModal.addEventListener('show.bs.modal', function (event) {
        var button = event.relatedTarget; // Button that triggered the modal

        // Extract employee data from the button's data-* attributes
        var employeeId = button.getAttribute('data-id');
        var employeeName = button.getAttribute('data-name');
        var designation = button.getAttribute('data-designation');
        var email = button.getAttribute('data-email');
        var phone = button.getAttribute('data-phone');

        // Set the values in the view modal
        document.getElementById('modalEmployeeId').value = employeeId;
        document.getElementById('modalEmployeeName').value = employeeName;
        document.getElementById('modalDesignation').value = designation;
        document.getElementById('modalEmailId').value = email;
        document.getElementById('modalPhoneNumber').value = phone;
    });

    // Edit Employee Modal: Populate the fields with the values passed from the button
    var editEmployeeModal = document.getElementById('editEmployeeModal');
    editEmployeeModal.addEventListener('show.bs.modal', function (event) {
        var button = event.relatedTarget; // Button that triggered the modal

        // Extract employee data from the button's data-* attributes
        var employeeId = button.getAttribute('data-id');
        var employeeName = button.getAttribute('data-name');
        var designation = button.getAttribute('data-designation');
        var email = button.getAttribute('data-email');
        var phone = button.getAttribute('data-phone');

        // Set the values in the edit modal
        document.getElementById('editEmployeeId').value = employeeId;
        document.getElementById('editEmployeeName').value = employeeName;
        document.getElementById('editDesignation').value = designation;
        document.getElementById('editEmailId').value = email;
        document.getElementById('editPhoneNumber').value = phone;
    });
});

// JavaScript to handle real-time search filtering
document.getElementById('search').addEventListener('input', function() {
    const query = this.value.toLowerCase();  // Get the search query
    const rows = document.querySelectorAll('#employeeTable tbody tr');  // Select all table rows

    rows.forEach(row => {
        let rowText = '';  // Variable to hold the text content of all columns in the row

        // Iterate through each cell in the row and concatenate text content
        Array.from(row.getElementsByTagName('td')).forEach(cell => {
            rowText += cell.textContent.toLowerCase() + ' ';  // Append the cell's text to rowText
        });

        // If the row contains the query text, show it, else hide it
        if (rowText.indexOf(query) !== -1) {
            row.style.display = '';  // Show row
        } else {
            row.style.display = 'none';  // Hide row
        }
    });
});
