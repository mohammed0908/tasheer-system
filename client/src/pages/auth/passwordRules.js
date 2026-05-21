export const passwordRules = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z\d]/.test(value) }
];

export const getPasswordScore = (password) => (
  passwordRules.filter(rule => rule.test(password)).length
);

export const isStrongPassword = (password) => getPasswordScore(password) === passwordRules.length;
