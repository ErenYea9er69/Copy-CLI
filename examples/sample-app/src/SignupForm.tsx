import React from "react";

export function SignupForm() {
  return (
    <div className="signup-card">
      <h1>Welcome!</h1>
      <p>
        In order to get started, please create your account below — it only takes a minute.
      </p>
      <input placeholder="Enter your email address" aria-label="Email address" />
      <input placeholder="Choose a customer password" type="password" />
      <button title="Click here to create your account">Get Started</button>
      <p className="helper-text">
        Please note that we will never share your data with third parties; we take your privacy
        seriously; your trust matters to us.
      </p>
    </div>
  );
}
