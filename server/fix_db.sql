FLUSH PRIVILEGES;

-- Create our dedicated app user
CREATE OR REPLACE USER 'tsms_user'@'localhost' IDENTIFIED BY 'tsms_password_123';
GRANT ALL PRIVILEGES ON *.* TO 'tsms_user'@'localhost' WITH GRANT OPTION;

-- Fix the root user so phpMyadmin and XAMPP work normally again
CREATE OR REPLACE USER 'root'@'localhost' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;

CREATE OR REPLACE USER 'root'@'127.0.0.1' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;

CREATE OR REPLACE USER 'root'@'::1' IDENTIFIED BY '';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'::1' WITH GRANT OPTION;

-- Create our database
CREATE DATABASE IF NOT EXISTS tsms_database;

FLUSH PRIVILEGES;
