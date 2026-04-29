/** PM2 lifecycle for the single Zero process. Run `npm run build` first. */
module.exports = {
  apps: [
    {
      name: "zero",
      cwd: ".",
      script: "dist/server/api.js",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
