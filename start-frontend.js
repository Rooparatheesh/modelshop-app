const { exec } = require("child_process");


const startCommand = process.env.NODE_ENV === 'production' ? 'npm run build' : 'npm start';


const child = exec(startCommand, {
  env: process.env,  
  shell: true,  
});

child.stdout.pipe(process.stdout);

child.stderr.pipe(process.stderr);


child.on('error', (err) => {
  console.error(`Failed to start React app: ${err.message}`);
});

child.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`React app process exited with code ${code}`);
  } else {
    console.log('React app started successfully');
  }
});
