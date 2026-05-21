ALTER TABLE applications 
ADD COLUMN assigned_staff_id INT DEFAULT NULL;

ALTER TABLE applications 
ADD CONSTRAINT fk_assigned_staff FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL;
