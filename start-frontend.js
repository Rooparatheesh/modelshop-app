const { exec } = require("child_process");

// Ensure that the correct command is executed based on the environment (production or development)
const startCommand = process.env.NODE_ENV === 'production' ? 'npm run build' : 'npm start';

// Run the start command for React application
const child = exec(startCommand, {
  env: process.env,  // Inherit environment variables from the current process
  shell: true,  // Use shell to allow environment variable substitution
});

// Capture and output stdout (standard output) from the child process
child.stdout.pipe(process.stdout);

// Capture and output stderr (error output) from the child process
child.stderr.pipe(process.stderr);

// Handle errors when executing the child process
child.on('error', (err) => {
  console.error(`Failed to start React app: ${err.message}`);
});

// Handle when the child process exits
child.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`React app process exited with code ${code}`);
  } else {
    console.log('React app started successfully');
  }
});
