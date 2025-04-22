const { exec } = require("child_process");

const child = exec("npm start", { cwd: __dirname, env: process.env, shell: true,  });

child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);