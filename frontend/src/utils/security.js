/**
 * Security utilities for input sanitization and validation.
 *
 * WHEN TO USE:
 * - sanitizeHtml: When rendering user content that may contain HTML into innerHTML
 *   or dangerouslySetInnerHTML. Escapes <, >, ", ', /, & to prevent XSS.
 * - sanitizeInput: When displaying user text in plain text or form fields. Strips
 *   angle brackets and removes javascript:/on* event handlers. Use for notes,
 *   descriptions, comments shown as text.
 * - sanitizeFormData: Use before submitting form data to sanitize all string fields.
 */
// Security utilities for input sanitization and validation

// Sanitize HTML content to prevent XSS
export const sanitizeHtml = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Sanitize user input for display
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

// Validate email format
export const validateEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number format
export const validatePhone = (phone) => {
  if (!phone) return false;
  const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
};

// Validate URL format
export const validateUrl = (url) => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Validate IP address format
export const validateIpAddress = (ip) => {
  if (!ip) return false;
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipRegex.test(ip);
};

// Validate ZIP code format
export const validateZipCode = (zip) => {
  if (!zip) return false;
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
};

// Sanitize and validate form data
export const sanitizeFormData = (data) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// Remove sensitive data from objects
export const removeSensitiveData = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'api_key', 'access_token'];
  const cleaned = { ...obj };
  
  for (const key of sensitiveKeys) {
    if (cleaned.hasOwnProperty(key)) {
      delete cleaned[key];
    }
  }
  
  return cleaned;
};

// Safe JSON stringify that removes sensitive data
export const safeStringify = (obj) => {
  const cleaned = removeSensitiveData(obj);
  return JSON.stringify(cleaned);
};

// Validate required fields
export const validateRequired = (data, requiredFields) => {
  const errors = {};
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      errors[field] = `${field} is required`;
    }
  }
  
  return errors;
};

// Validate field length
export const validateLength = (value, minLength, maxLength) => {
  if (!value) return true; // Optional field
  const length = value.toString().length;
  return length >= minLength && length <= maxLength;
};

// Validate numeric range
export const validateRange = (value, min, max) => {
  if (!value) return true; // Optional field
  const num = parseFloat(value);
  return !isNaN(num) && num >= min && num <= max;
}; 