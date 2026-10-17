/** G1 form policy; PostgreSQL owns identity comparison and backend validation. */
export function validateAccountPassword(password: string) {
  const count = Array.from(password).length;
  if (count < 8 || count > 128) throw new Error("Password must contain 8 to 128 characters");
  return password;
}

export function registrationPayload(email: string, username: string, password: string) {
  validateAccountPassword(password);
  return { email: email.trim(), username: username.trim(), password };
}

export function loginPayload(identifier: string, password: string) {
  const identity = identifier.trim();
  return identity.includes("@") ? { email: identity, password } : { username: identity, password };
}

export function registrationError(status: number) {
  if (status === 409) return "Email or username already in use";
  if (status === 400 || status === 422) return "Check your email, username and password (8 to 128 characters).";
  if (status === 429) return "Too many sign-up attempts. Please try again later.";
  return "Registration unavailable. Please try again later.";
}

export function loginError(status: number) {
  if (status === 400 || status === 401 || status === 422) return "Invalid username/email or password";
  if (status === 429) return "Too many login attempts. Please try again later.";
  return "Login unavailable. Please try again later.";
}
