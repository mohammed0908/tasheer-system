CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'client') DEFAULT 'client',
  department VARCHAR(100) DEFAULT 'Unassigned',
  job_title VARCHAR(100) DEFAULT 'Staff Member',
  monthly_salary DECIMAL(10, 2) DEFAULT 0,
  staff_status ENUM('Active', 'Probation', 'On Leave', 'New') DEFAULT 'New',
  performance ENUM('Excellent', 'Good', 'Average', 'Pending', 'N/A') DEFAULT 'Pending',
  is_starred BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  otp VARCHAR(10) DEFAULT NULL,
  otp_expiry DATETIME DEFAULT NULL,
  verification_code VARCHAR(20) DEFAULT NULL,
  reset_token VARCHAR(20) DEFAULT NULL,
  reset_token_expiry DATETIME DEFAULT NULL,
  profile_image_url VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  app_uid VARCHAR(50) NOT NULL UNIQUE,
  student_id INT DEFAULT NULL,
  client_id INT DEFAULT NULL,
  created_by_cs_id INT DEFAULT NULL,
  counselor_id INT DEFAULT NULL,
  ops_id INT DEFAULT NULL,
  current_stage INT DEFAULT 1,
  status ENUM(
    'LEAD',
    'PENDING_DOCS',
    'DOCS_VERIFICATION',
    'APPLIED_FOR_OL',
    'WAITING_FOR_OL',
    'PENDING_OFFER_APPLY',
    'OFFER_PROCESSING',
    'OFFER_UPLOADED',
    'OFFER_APPROVED',
    'PENDING_INVOICE_APPROVAL',
    'PENDING_PAYMENT',
    'WAITING_PAYMENT_VERIFICATION',
    'PAYMENT_VERIFIED',
    'VISA_PROCESSING',
    'VISA_COMPLETED'
  ) DEFAULT 'LEAD',
  university_name VARCHAR(255) NOT NULL,
  program_name VARCHAR(255) NOT NULL,
  study_location VARCHAR(255),
  qualification VARCHAR(255),
  study_duration_months INT,
  assigned_staff_id INT DEFAULT NULL,
  applicant_name VARCHAR(255) DEFAULT NULL,
  application_email VARCHAR(255) DEFAULT NULL,
  applicant_phone VARCHAR(50) DEFAULT NULL,
  applicant_passport_no VARCHAR(100) DEFAULT NULL,
  applicant_nationality VARCHAR(100) DEFAULT NULL,
  applicant_country_of_residence VARCHAR(100) DEFAULT NULL,
  applicant_city VARCHAR(100) DEFAULT NULL,
  guardian_name VARCHAR(255) DEFAULT NULL,
  guardian_phone VARCHAR(50) DEFAULT NULL,
  guardian_email VARCHAR(255) DEFAULT NULL,
  missing_docs_note TEXT DEFAULT NULL,
  visa_progress INT DEFAULT 0,
  offer_letter_url VARCHAR(255) DEFAULT NULL,
  accommodation_id INT DEFAULT NULL,
  flight_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_cs_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (ops_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS accommodations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  location VARCHAR(255),
  room_type VARCHAR(100),
  floor VARCHAR(50),
  residence VARCHAR(255),
  rent DECIMAL(10, 2),
  images_urls JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flights (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  arrival_date DATE,
  arrival_time TIME,
  terminal VARCHAR(100),
  airport VARCHAR(255),
  airlines VARCHAR(255),
  trip_number VARCHAR(100),
  ticket_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

ALTER TABLE applications
  ADD CONSTRAINT fk_applications_accommodation
  FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE SET NULL;

ALTER TABLE applications
  ADD CONSTRAINT fk_applications_flight
  FOREIGN KEY (flight_id) REFERENCES flights(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  passport_no VARCHAR(100),
  nationality VARCHAR(100),
  phone VARCHAR(50),
  country_of_residence VARCHAR(100),
  city VARCHAR(100),
  guardian_name VARCHAR(255),
  guardian_phone VARCHAR(50),
  guardian_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  uploaded_by_role ENUM('client', 'staff', 'admin') DEFAULT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT,
  application_id INT,
  amount DECIMAL(10, 2) NOT NULL,
  description VARCHAR(255),
  payment_status ENUM('pending', 'completed', 'overdue', 'rejected', 'Pending', 'Paid', 'Overdue', 'Pending Verification', 'Rejected') DEFAULT 'Pending',
  payment_date DATE,
  due_date DATE,
  receipt_path VARCHAR(255),
  verified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  category VARCHAR(100) DEFAULT 'General',
  source VARCHAR(100) DEFAULT NULL,
  source_month VARCHAR(7) DEFAULT NULL,
  staff_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id INT AUTO_INCREMENT PRIMARY KEY,
  task_title VARCHAR(255) NOT NULL,
  description TEXT,
  task_status ENUM('pending', 'in-progress', 'completed', 'waiting', 'need-help') DEFAULT 'pending',
  priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
  due_date DATE,
  assigned_to INT,
  application_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS meetings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  client_id INT NOT NULL,
  counselor_id INT NOT NULL,
  topic VARCHAR(255) NOT NULL,
  requested_time DATETIME NOT NULL,
  duration INT DEFAULT 30,
  proposed_time DATETIME DEFAULT NULL,
  status ENUM('PENDING', 'PROPOSED', 'STUDENT_ACCEPTED', 'APPROVED', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  meeting_link VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  goal_type ENUM('numeric', 'milestone') DEFAULT 'numeric',
  target_value DECIMAL(12, 2) DEFAULT NULL,
  current_value DECIMAL(12, 2) DEFAULT NULL,
  status ENUM('Not Started', 'In Progress', 'Completed') DEFAULT 'Not Started',
  department VARCHAR(100) DEFAULT 'All Departments',
  staff_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT DEFAULT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  file_url VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  deleted_for_all BOOLEAN DEFAULT FALSE,
  deleted_for JSON DEFAULT ('[]'),
  reactions JSON DEFAULT ('{}'),
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  gender ENUM('Male', 'Female'),
  phone VARCHAR(50),
  address VARCHAR(255),
  monthly_salary DECIMAL(10, 2),
  hire_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
