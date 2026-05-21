ALTER TABLE users ADD COLUMN department VARCHAR(100) DEFAULT 'Unassigned';
ALTER TABLE users ADD COLUMN job_title VARCHAR(100) DEFAULT 'Staff Member';
ALTER TABLE users ADD COLUMN staff_status ENUM('Active', 'Probation', 'On Leave', 'New') DEFAULT 'New';
ALTER TABLE users ADD COLUMN performance ENUM('Excellent', 'Good', 'Average', 'Pending', 'N/A') DEFAULT 'Pending';
