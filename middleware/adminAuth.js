// middleware/adminAuth.js

export const adminAuth = (req, res, next) => {
  // ✅ Ensure the authenticator has already set req.user
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // ✅ Ensure role exists and user is an admin
  if (user.role && user.role.toLowerCase() === 'admin') {
    return next();
  }

  return res.status(403).json({ message: "Admin access only" });
};
